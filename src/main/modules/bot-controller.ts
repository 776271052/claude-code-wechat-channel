// Bot Controller — orchestrates bot start/stop lifecycle
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import { startPolling } from './polling'
import { createBotMessageHandler } from './bot-handler'
import { getActiveProcesses, killProcess, killAllProcesses } from './claude-runner'
import { loadCredentials } from './credentials'
import { probeCliVersion } from './cli-discovery'
import { log, logError } from '../utils/logger'
import type { BrowserWindow } from 'electron'
import type { BotStatus, StartConfig, PollingStatus, IncomingMessageContext, ClaudeProcessInfo } from '../../shared/types'

export class BotController {
  private pollingAbort: AbortController | null = null
  private pollingPromise: Promise<void> | null = null
  private emitter = new EventEmitter()
  private _state: BotStatus['state'] = 'idle'
  private _pollingStatus: PollingStatus = 'disconnected'
  private _errorMessage: string | undefined
  private _config: StartConfig | null = null
  private _windowCleanup: (() => void) | null = null
  private _generation = 0

  getStatus(): BotStatus {
    return {
      state: this._state,
      account: loadCredentials(),
      mode: this._config?.mode ?? 'cli',
      permissionMode: this._config?.permissionMode ?? 'default',
      cliPath: this._config?.cliPath ?? null,
      apiUrl: this._config?.apiUrl ?? null,
      pollingStatus: this._pollingStatus,
      errorMessage: this._errorMessage,
    }
  }

  getActiveProcesses(): ClaudeProcessInfo[] {
    return getActiveProcesses()
  }

  killProcess(id: string): boolean {
    return killProcess(id)
  }

  attachWindow(win: BrowserWindow): void {
    // 清理旧的监听器，避免重复绑定
    if (this._windowCleanup) {
      this._windowCleanup()
      this._windowCleanup = null
    }

    const send = (ch: string, data?: unknown) => {
      if (win && !win.isDestroyed()) win.webContents.send(ch, data)
    }

    const listeners: Array<[string, (...args: any[]) => void]> = [
      ['message', (ctx: IncomingMessageContext) => send('wechat:messageReceived', ctx)],
      ['messageSent', (d: unknown) => send('wechat:messageSent', d)],
      ['messageError', (d: unknown) => send('wechat:messageError', d)],
      ['statusChange', (s: PollingStatus) => {
        this._pollingStatus = s
        send('wechat:pollingStatus', s)
      }],
      ['error', (err: Error) => send('wechat:logEntry', { level: 'error', message: err.message, timestamp: Date.now() })],
      ['cliOutput', (d: { type: string; data: string }) => send('wechat:cliOutput', d)],
      ['cliExit', (d: { code: number | null }) => send('wechat:cliExit', d)],
      ['taskStatus', (d: { phase: string; message: string; target: string; elapsed?: number; success?: boolean; error?: string }) => send('wechat:taskStatus', d)],
    ]

    for (const [event, handler] of listeners) {
      this.emitter.on(event, handler)
    }

    this._windowCleanup = () => {
      for (const [event, handler] of listeners) {
        this.emitter.removeListener(event, handler)
      }
    }
  }

  async start(config: StartConfig): Promise<void> {
    if (this._state === 'running' || this._state === 'starting') {
      throw new Error('Bot is already running')
    }

    this._state = 'starting'
    this._errorMessage = undefined
    this._config = config

    const account = loadCredentials()
    if (!account) throw new Error('未登录，请先扫码登录')

    // Validate based on mode
    if (config.mode === 'api') {
      if (!config.apiUrl?.trim()) throw new Error('API URL 不能为空')
      if (!config.apiToken?.trim()) throw new Error('API Token 不能为空')
      log(`API 模式: model=${config.model} url=${config.apiUrl}`)
    } else {
      // Validate CLI — file must exist; probe is best-effort
      if (!fs.existsSync(config.cliPath)) {
        throw new Error(`Claude CLI 文件不存在: ${config.cliPath}`)
      }
      const version = await probeCliVersion(config.cliPath)
      if (version) {
        log(`验证 CLI 成功: ${config.cliPath} (${version})`)
      } else {
        log(`警告: CLI 文件存在但版本检测失败，继续启动: ${config.cliPath}`)
      }
    }

    this.pollingAbort = new AbortController()
    this._generation++
    const gen = this._generation

    const handler = createBotMessageHandler(account, config, this.emitter)
    this.pollingPromise = startPolling(account, handler, this.emitter, this.pollingAbort.signal)

    this._state = 'running'
    log('Bot 已启动')

    // Handle polling completion (e.g. fatal error or abort)
    this.pollingPromise.then(() => {
      if (this._state === 'running' && this._generation === gen) {
        this._state = 'idle'
        this._pollingStatus = 'disconnected'
      }
    }).catch((err) => {
      if (this._generation === gen) {
        this._state = 'error'
        this._errorMessage = String(err)
        logError(`Bot 异常退出: ${String(err)}`)
      }
    })
  }

  async restart(config?: StartConfig): Promise<void> {
    log('正在重启 Bot...')
    const restartConfig = config ?? this._config
    if (!restartConfig) throw new Error('没有可用的配置，无法重启')
    await this.stop()
    await this.start(restartConfig)
    log('Bot 重启完成')
  }

  async stop(): Promise<void> {
    if (this._state === 'idle' || this._state === 'stopping') return

    this._state = 'stopping'
    log('正在停止 Bot...')

    this.pollingAbort?.abort()
    const killed = killAllProcesses()
    if (killed > 0) log(`已终止 ${killed} 个运行中的 Claude CLI 进程`)

    try {
      await Promise.race([
        this.pollingPromise,
        new Promise(r => setTimeout(r, 3000)),
      ])
    } catch { /* ignore */ }

    this._state = 'idle'
    this._pollingStatus = 'disconnected'
    this.pollingAbort = null
    this.pollingPromise = null
    log('Bot 已停止')
  }
}
