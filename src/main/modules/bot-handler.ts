// Bot Handler — creates queued message handler with concurrency pool
import { EventEmitter } from 'node:events'
import { runClaudePrintMode, buildClaudePrompt, normalizeClaudeReply } from './claude-runner'
import { runApiMode } from './openai-runner'
import { sendTextMessage } from './wechat-api'
import { startTypingRefresher } from './typing'
import { getAppDir } from '../utils/paths'
import { log, logError } from '../utils/logger'
import type { AccountData, IncomingMessageContext, StartConfig } from '../../shared/types'

const MAX_CONCURRENT = 3
const SPLIT_THRESHOLD = 2000
const MSG_DELAY_MS = 300
let taskSeq = 0

function splitReply(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const parts: string[] = []
  let remaining = text
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen)
    if (splitAt < maxLen * 0.3) splitAt = maxLen
    parts.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).replace(/^\n+/, '')
  }
  if (remaining) parts.push(remaining)
  return parts
}

export function createBotMessageHandler(
  account: AccountData,
  config: StartConfig,
  emitter: EventEmitter,
): (ctx: IncomingMessageContext) => Promise<void> {
  const queue: IncomingMessageContext[] = []
  let activeCount = 0

  async function processOne(ctx: IncomingMessageContext): Promise<void> {
    if (!ctx.canReply || !ctx.contextToken) {
      logError(`无法回复：缺少 context_token target=${ctx.replyTarget}`)
      return
    }

    const userMsg = ctx.extracted.text.slice(0, 30)
    const taskStart = Date.now()
    const taskId = `task-${++taskSeq}`

    // 通知 GUI: 任务开始
    emitter.emit('taskStatus', { taskId, phase: 'start', message: userMsg, target: ctx.replyTarget, startedAt: taskStart })

    const prompt = buildClaudePrompt(ctx)
    const modeLabel = config.mode === 'api' ? `API (${config.model})` : 'CLI'
    log(`调用 ${modeLabel}: target=${ctx.replyTarget} (并发 ${activeCount}/${MAX_CONCURRENT})`)

    // 通知 GUI: 正在执行
    emitter.emit('taskStatus', { taskId, phase: 'running', message: userMsg, target: ctx.replyTarget })

    // 仅用输入状态提示用户（不发额外消息）
    const typingRefresher = startTypingRefresher(account.baseUrl, account.token, ctx.senderId, ctx.contextToken)

    let result: { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }
    try {
      if (config.mode === 'api') {
        result = await runApiMode({
          prompt,
          apiUrl: config.apiUrl,
          apiToken: config.apiToken,
          model: config.model,
          timeoutMs: config.timeoutMs,
          maxTokens: config.apiMaxTokens,
          systemPrompt: config.apiSystemPrompt || undefined,
          protocol: config.apiProtocol,
          onStdoutChunk: (chunk) => emitter.emit('cliOutput', { type: 'stdout', data: chunk }),
        })
      } else {
        result = await runClaudePrintMode({
          prompt,
          cliPath: config.cliPath,
          cwd: config.workdir || getAppDir(),
          timeoutMs: config.timeoutMs,
          extraArgs: config.extraArgs,
          permissionMode: config.permissionMode,
          replyTarget: ctx.replyTarget,
          onStdoutChunk: (chunk) => emitter.emit('cliOutput', { type: 'stdout', data: chunk }),
          onStderrChunk: (chunk) => emitter.emit('cliOutput', { type: 'stderr', data: chunk }),
          onExit: (code) => emitter.emit('cliExit', { code }),
        })
      }
    } catch (err) {
      // Runner threw an unexpected exception — reply to user and clear task
      const elapsed = Math.floor((Date.now() - taskStart) / 1000)
      const errMsg = err instanceof Error ? err.message : String(err)
      logError(`Runner 异常: ${errMsg}`)
      emitter.emit('taskStatus', { taskId, phase: 'done', message: userMsg, target: ctx.replyTarget, elapsed, success: false, error: errMsg })
      try {
        await sendTextMessage(account.baseUrl, account.token, ctx.replyTarget, '❌ 处理异常，请稍后再试。', ctx.contextToken)
      } catch { /* ignore send failure */ }
      typingRefresher.stop()
      return
    } finally {
      typingRefresher.stop()
    }

    const elapsed = Math.floor((Date.now() - taskStart) / 1000)

    if (result.stderr.trim()) {
      logError(`Claude CLI stderr: ${result.stderr.trim().slice(0, 1000)}`)
    }
    log(`Claude CLI 结果: exitCode=${result.exitCode} timedOut=${result.timedOut} elapsed=${elapsed}s stdout=${result.stdout.length}chars`)

    const failed = result.timedOut || result.exitCode !== 0
    let reply: string
    if (!failed) {
      reply = normalizeClaudeReply(result.stdout)
      emitter.emit('taskStatus', { taskId, phase: 'done', message: userMsg, target: ctx.replyTarget, elapsed, success: true })
    } else if (result.timedOut) {
      reply = '❌ 处理超时，任务可能太复杂，请尝试拆分成更小的指令。'
      emitter.emit('taskStatus', { taskId, phase: 'done', message: userMsg, target: ctx.replyTarget, elapsed, success: false, error: 'timeout' })
    } else if (result.exitCode === null) {
      reply = '❌ Claude CLI 无法启动，请在设置中检查 CLI 路径是否正确。'
      emitter.emit('taskStatus', { taskId, phase: 'done', message: userMsg, target: ctx.replyTarget, elapsed, success: false, error: 'cli_not_found' })
    } else if (result.stderr.includes('ENOENT') || result.stderr.includes('not found')) {
      reply = '❌ 找不到 Claude CLI，请在设置中配置正确的路径。'
      emitter.emit('taskStatus', { taskId, phase: 'done', message: userMsg, target: ctx.replyTarget, elapsed, success: false, error: 'enoent' })
    } else {
      const errHint = result.stderr.trim().slice(0, 200)
      reply = `❌ 处理失败 (exit ${result.exitCode})${errHint ? ': ' + errHint : ''}`
      emitter.emit('taskStatus', { taskId, phase: 'done', message: userMsg, target: ctx.replyTarget, elapsed, success: false, error: errHint })
    }

    // Split long replies into multiple messages
    const parts = splitReply(reply, SPLIT_THRESHOLD)

    try {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const suffix = parts.length > 1 ? ` (${i + 1}/${parts.length})` : ''
        const text = part + suffix
        await sendTextMessage(account.baseUrl, account.token, ctx.replyTarget, text, ctx.contextToken)
        log(`已发送回复: target=${ctx.replyTarget} part=${i + 1}/${parts.length} chars=${text.length}`)
        emitter.emit('messageSent', { target: ctx.replyTarget, text, chars: text.length })
        if (i < parts.length - 1) await new Promise(r => setTimeout(r, MSG_DELAY_MS))
      }
    } catch (err) {
      logError(`发送微信回复失败: ${String(err)}`)
      emitter.emit('messageError', { target: ctx.replyTarget, error: String(err) })
    }
  }

  async function drainQueue(): Promise<void> {
    while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
      const ctx = queue.shift()!
      activeCount++
      processOne(ctx).catch(err => logError(`处理异常: ${String(err)}`)).finally(() => {
        activeCount--
        drainQueue().catch(err => logError(`队列处理异常: ${String(err)}`))
      })
    }
  }

  return async (ctx: IncomingMessageContext) => {
    queue.push(ctx)
    drainQueue().catch(err => logError(`队列处理异常: ${String(err)}`))
  }
}
