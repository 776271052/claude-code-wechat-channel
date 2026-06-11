// Claude CLI Runner — spawn claude --print with streaming support
import { spawn, type ChildProcess } from 'node:child_process'
import { MAX_REPLY_CHARS } from './config'
import type { ClaudeProcessInfo } from '../../shared/types'

interface ClaudeRunOptions {
  prompt: string
  cliPath: string
  cwd: string
  timeoutMs: number
  extraArgs: string[]
  permissionMode: string
  replyTarget?: string
  onStdoutChunk?: (chunk: string) => void
  onStderrChunk?: (chunk: string) => void
  onExit?: (code: number | null) => void
}

// --- Process registry ---
let processSeq = 0
const activeProcesses = new Map<string, { info: ClaudeProcessInfo; child: ChildProcess }>()

// Track the latest bot CLI process ID for stdin input
let currentBotProcId: string | null = null

export function writeToCurrentBotStdin(text: string): boolean {
  if (!currentBotProcId) return false
  const entry = activeProcesses.get(currentBotProcId)
  if (!entry || !entry.child.stdin || entry.child.stdin.destroyed) return false
  try {
    entry.child.stdin.write(text.endsWith('\n') ? text : text + '\n')
    return true
  } catch { return false }
}

export function getActiveProcesses(): ClaudeProcessInfo[] {
  // Clean up dead processes on read
  for (const [id, entry] of activeProcesses) {
    if (entry.child.exitCode !== null || entry.child.killed) {
      entry.info.status = 'exited'
    }
  }
  return Array.from(activeProcesses.values()).map((e) => ({ ...e.info }))
}

export function killProcess(id: string): boolean {
  const entry = activeProcesses.get(id)
  if (!entry) return false
  try {
    entry.child.kill(process.platform === 'win32' ? undefined : 'SIGTERM')
    entry.info.status = 'exited'
    return true
  } catch {
    return false
  }
}

export function killAllProcesses(): number {
  let count = 0
  for (const [id] of activeProcesses) {
    if (killProcess(id)) count++
  }
  return count
}

export function registerProcess(child: ChildProcess, label: string): string {
  const procId = `proc-${++processSeq}`
  const procInfo: ClaudeProcessInfo = {
    id: procId,
    pid: child.pid ?? 0,
    status: 'running',
    startedAt: Date.now(),
    prompt: label,
    replyTarget: '',
  }
  activeProcesses.set(procId, { info: procInfo, child })
  const cleanup = () => { procInfo.status = 'exited'; activeProcesses.delete(procId) }
  child.on('exit', cleanup)
  child.on('error', cleanup)
  return procId
}

interface ClaudePrintResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}

const MAX_STDOUT_BYTES = 5 * 1024 * 1024
const MAX_STDERR_BYTES = 1 * 1024 * 1024

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
}

export function runClaudePrintMode(opts: ClaudeRunOptions): Promise<ClaudePrintResult> {
  const args = [
    ...opts.extraArgs,
  ]

  // Map permission mode to CLI flags
  if (opts.permissionMode === 'bypassPermissions') {
    args.push('--dangerously-skip-permissions')
  } else if (opts.permissionMode && opts.permissionMode !== 'default') {
    args.push('--permission-mode', opts.permissionMode)
  }

  args.push(
    '--print', opts.prompt,
  )

  const timeoutMs = opts.timeoutMs || 0

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const child: ChildProcess = spawn(opts.cliPath, args, {
      cwd: opts.cwd,
      env: { ...process.env, CLAUDE_CODE_DISABLE_NO_STDIN_WARNING: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Track as latest bot process for stdin input
    currentBotProcId = procId
    child.stdin?.end()
    child.on('close', () => { if (currentBotProcId === procId) currentBotProcId = null })
    child.on('error', () => { if (currentBotProcId === procId) currentBotProcId = null })

    // Register in process registry
    const procId = `proc-${++processSeq}`
    const procInfo: ClaudeProcessInfo = {
      id: procId,
      pid: child.pid ?? 0,
      status: 'running',
      startedAt: Date.now(),
      prompt: opts.prompt.slice(0, 200),
      replyTarget: opts.replyTarget ?? '',
    }
    activeProcesses.set(procId, { info: procInfo, child })

    const cleanup = () => {
      procInfo.status = 'exited'
      activeProcesses.delete(procId)
    }

    // Only set timer if timeout > 0
    const timer = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true
      child.kill(process.platform === 'win32' ? undefined : 'SIGTERM')
      setTimeout(() => { try { child.kill('SIGKILL') } catch { /* already dead */ } }, 5_000)
    }, timeoutMs) : null

    child.stdout?.on('data', (chunk) => {
      if (stdout.length < MAX_STDOUT_BYTES) {
        const text = chunk.toString('utf-8')
        stdout += text
        opts.onStdoutChunk?.(text)
      }
    })
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < MAX_STDERR_BYTES) {
        const text = chunk.toString('utf-8')
        stderr += text
        opts.onStderrChunk?.(text)
      }
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      cleanup()
      const errMsg = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? `Claude CLI 不存在: ${opts.cliPath}`
        : `Claude CLI 启动失败: ${String(err)}`
      resolve({ stdout, stderr: `${stderr}\n${errMsg}`.trim(), exitCode: null, timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      cleanup()
      opts.onExit?.(code)
      resolve({ stdout, stderr, exitCode: code, timedOut })
    })
  })
}

export function normalizeClaudeReply(raw: string): string {
  const text = stripAnsi(raw).trim()
  if (!text) return '抱歉，我没有生成有效回复。'
  if (text.length <= MAX_REPLY_CHARS) return text
  return `${text.slice(0, MAX_REPLY_CHARS)}\n（回复过长，已截断）`
}

export function buildClaudePrompt(ctx: {
  isGroup: boolean
  groupId?: string
  senderShort: string
  extracted: { msgType: string; text: string }
}): string {
  const chatType = ctx.isGroup ? '群聊' : '私聊'
  const groupLine = ctx.isGroup ? `群 ID: ${ctx.groupId}\n` : ''
  return [
    '你是一个通过微信消息控制的 AI 助手。用户通过微信给你发送指令，你需要实际执行这些指令。',
    '规则：',
    '- 直接执行用户的操作指令（创建文件、写代码、运行命令等），不要只是描述步骤',
    '- 执行完成后，用简短的中文回复结果',
    '- 纯文本回复，不要 Markdown',
    '- 不要反问用户确认，直接执行',
    '- 中文优先，除非用户使用其他语言',
    '',
    `聊天类型: ${chatType}`,
    groupLine.trimEnd(),
    `发送者: ${ctx.senderShort}`,
    `消息类型: ${ctx.extracted.msgType}`,
    '',
    '用户消息:',
    ctx.extracted.text,
  ].filter(Boolean).join('\n')
}
