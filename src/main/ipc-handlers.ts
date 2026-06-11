// IPC Handlers — all ipcMain.handle registrations
import { ipcMain, dialog, shell, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import { BotController } from './modules/bot-controller'
import { fetchQRCode, pollQRStatus, saveLoginResult } from './modules/qr-login'
import { loadCredentials, clearCredentials } from './modules/credentials'
import { scanForClaudeCli, probeCliVersion, saveCliPreference, resolveLatestCliPath, diagnoseCliResolution } from './modules/cli-discovery'
import { checkForUpdate, downloadUpdate, type DownloadProgress } from './modules/updater'
import { registerProcess, writeToCurrentBotStdin } from './modules/claude-runner'
import { testApiConnection, fetchModels } from './modules/openai-runner'
import { SETTINGS_FILE, getAppDir } from './utils/paths'
import { DEFAULT_BASE_URL } from './modules/config'
import type { CliCandidate, AppSettings, StartConfig, SystemCliProcess, QRStatusResponse } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  mode: 'cli',
  cliPath: '',
  permissionMode: 'default',
  timeoutMs: 600_000,
  workdir: '',
  extraArgs: [],
  apiProtocol: 'openai',
  apiUrl: '',
  apiToken: '',
  model: '',
  apiMaxTokens: 4096,
  apiSystemPrompt: '',
}

function loadAppSettings(): AppSettings {
  const settings = { ...DEFAULT_SETTINGS }
  try {
    if (fs.existsSync(SETTINGS_FILE())) {
      Object.assign(settings, JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf-8')))
    }
  } catch { /* ignore */ }
  // Auto-discover CLI if not configured
  if (!settings.cliPath) {
    const resolved = resolveLatestCliPath(null)
    if (resolved) {
      settings.cliPath = resolved
      saveCliPreference(resolved)
    }
  }
  return settings
}

function saveAppSettings(s: Partial<AppSettings>): void {
  const current = loadAppSettings()
  const merged = { ...current, ...s }
  try { fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(merged, null, 2), 'utf-8') } catch { /* ignore */ }
}

export function registerIpcHandlers(bot: BotController, mainWindow: BrowserWindow): void {
  bot.attachWindow(mainWindow)

  ipcMain.handle('wechat:getStatus', async () => bot.getStatus())

  ipcMain.handle('wechat:startBot', async (_e, config: StartConfig) => {
    if (config.mode === 'api') {
      if (!config.apiUrl?.trim()) throw new Error('API URL 不能为空')
      if (!config.apiToken?.trim()) throw new Error('API Token 不能为空')
      await bot.start(config)
      return { resolvedCliPath: null }
    }

    const resolved = resolveLatestCliPath(config.cliPath)
    if (!resolved) {
      const diag = diagnoseCliResolution()
      const scan = (diag.scanResults as string[]) ?? []
      const lines = [
        '未找到 Claude CLI',
        '',
        `LOCALAPPDATA: ${(diag.env as Record<string, string | null>)?.LOCALAPPDATA ?? '(未设置)'}`,
        `APPDATA: ${(diag.env as Record<string, string | null>)?.APPDATA ?? '(未设置)'}`,
        `保存路径: ${(diag.prefContent as string) || '(空)'}`,
        `扫描结果: ${scan.length === 0 ? '未找到任何 CLI' : scan.join(', ')}`,
        `日志文件: ${(diag.logFile as string) ?? ''}`,
      ]
      throw new Error(lines.join('\n'))
    }
    if (resolved !== config.cliPath) {
      config = { ...config, cliPath: resolved }
      saveCliPreference(resolved)
    }
    await bot.start(config)
    return { resolvedCliPath: resolved }
  })

  ipcMain.handle('wechat:stopBot', async () => {
    await bot.stop()
  })

  ipcMain.handle('wechat:restartBot', async (_e, config?: StartConfig) => {
    await bot.restart(config)
  })

  ipcMain.handle('wechat:fetchQRCode', async () => {
    return fetchQRCode(DEFAULT_BASE_URL)
  })

  ipcMain.handle('wechat:pollQRStatus', async (_e, { qrcode }: { qrcode: string }) => {
    return pollQRStatus(DEFAULT_BASE_URL, qrcode)
  })

  ipcMain.handle('wechat:saveLoginResult', async (_e, status: QRStatusResponse) => {
    return saveLoginResult(status, DEFAULT_BASE_URL)
  })

  ipcMain.handle('wechat:loadCredentials', async () => loadCredentials())

  ipcMain.handle('wechat:clearCredentials', async () => {
    clearCredentials()
  })

  ipcMain.handle('wechat:scanForCli', async () => {
    const candidates = scanForClaudeCli()
    const results: CliCandidate[] = []
    for (const c of candidates) {
      const version = await probeCliVersion(c)
      const exists = fs.existsSync(c)
      results.push({ path: c, version: version ?? undefined, valid: Boolean(version) || exists })
    }
    return results
  })

  ipcMain.handle('wechat:validateCliPath', async (_e, { path: p }: { path: string }) => {
    const version = await probeCliVersion(p)
    return { valid: Boolean(version), version: version ?? undefined, error: version ? undefined : '无法执行该路径' }
  })

  ipcMain.handle('wechat:loadSettings', async () => loadAppSettings())

  ipcMain.handle('wechat:saveSettings', async (_e, settings: Partial<AppSettings>) => {
    saveAppSettings(settings)
  })

  ipcMain.handle('wechat:showOpenDialog', async (_e, opts: { title: string; filters?: Electron.FileFilter[]; properties?: Electron.OpenDialogOptions['properties'] }) => {
    return dialog.showOpenDialog(mainWindow, { title: opts.title, filters: opts.filters, properties: opts.properties ?? ['openFile'] })
  })

  // Process management
  ipcMain.handle('wechat:getActiveProcesses', async () => bot.getActiveProcesses())
  ipcMain.handle('wechat:killProcess', async (_e, { id }: { id: string }) => bot.killProcess(id))

  // Scan all Claude CLI processes running on the system
  ipcMain.handle('wechat:scanSystemCliProcesses', async (): Promise<SystemCliProcess[]> => {
    const { spawn } = await import('node:child_process')
    return new Promise((resolve) => {
      try {
        const ps = 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'claude.exe\' -and $_.CommandLine -match \'claude-code\' } | Select-Object ProcessId, CommandLine | ConvertTo-Json -Depth 3'
        const child = spawn('powershell', ['-NoProfile', '-Command', ps], { stdio: ['ignore', 'pipe', 'pipe'] })

        let stdout = ''
        child.stdout.on('data', (d) => { stdout += d.toString() })
        child.on('close', () => {
          try {
            let procs = JSON.parse(stdout.trim() || '[]')
            if (!Array.isArray(procs)) procs = [procs]
            resolve(procs.map((p: { ProcessId: number; CommandLine: string }) => ({
              pid: p.ProcessId,
              name: 'claude.exe',
              commandLine: p.CommandLine || '',
            })))
          } catch { resolve([]) }
        })
        child.on('error', () => resolve([]))
        setTimeout(() => { try { child.kill() } catch {} ; resolve([]) }, 10000)
      } catch { resolve([]) }
    })
  })

  // Kill a system CLI process by PID (direct taskkill, no PowerShell)
  ipcMain.handle('wechat:killSystemProcess', async (_e, { pid }: { pid: number }): Promise<boolean> => {
    const { spawn } = await import('node:child_process')
    return new Promise((resolve) => {
      try {
        const child = spawn('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' })
        child.on('close', (code) => resolve(code === 0))
        child.on('error', () => resolve(false))
        setTimeout(() => { try { child.kill() } catch {} ; resolve(false) }, 5000)
      } catch { resolve(false) }
    })
  })

  // Diagnose CLI path resolution
  ipcMain.handle('wechat:diagnoseCli', async () => diagnoseCliResolution())

  // Send input to the current bot CLI process stdin
  ipcMain.handle('wechat:sendCliInput', async (_e, { text }: { text: string }) => {
    return writeToCurrentBotStdin(text)
  })

  // Launch Claude CLI interactive mode
  ipcMain.handle('wechat:launchCli', async (_e, { cliPath, cwd, foreground }: { cliPath: string; cwd?: string; foreground?: boolean }) => {
    const { spawn } = await import('node:child_process')
    // Resolve to latest valid path
    const resolvedPath = resolveLatestCliPath(cliPath) ?? cliPath

    if (foreground) {
      // Foreground: open in a new terminal window, not tracked (user controls it directly)
      const args: string[] = []
      const options = { cwd: cwd || getAppDir(), env: process.env, detached: true, shell: true as const }
      if (process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', 'cmd', '/k', resolvedPath, ...args], options)
      } else {
        spawn('x-terminal-emulator', ['-e', resolvedPath, ...args], options).on('error', () => {
          spawn('osascript', ['-e', `tell app "Terminal" to do script "${resolvedPath}"`], options)
        })
      }
    } else {
      // Background: spawn interactive CLI, register in process panel for tracking/stopping
      const child = spawn(resolvedPath, [], {
        cwd: cwd || getAppDir(),
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      })
      const procId = registerProcess(child, `后台 CLI: ${resolvedPath.split(/[/\\]/).pop()}`)
      return { success: true, processId: procId }
    }

    return { success: true }
  })

  // API connection test
  ipcMain.handle('wechat:testApiConnection', async (_e, opts: { apiUrl: string; apiToken: string; model: string; protocol: string }) => {
    return testApiConnection(opts.apiUrl, opts.apiToken, opts.model, opts.protocol as any)
  })

  // Fetch available models from API
  ipcMain.handle('wechat:fetchModels', async (_e, opts: { apiUrl: string; apiToken: string; protocol: string }) => {
    return fetchModels(opts.apiUrl, opts.apiToken, opts.protocol as any)
  })

  // Updater
  ipcMain.handle('wechat:checkForUpdate', async () => checkForUpdate())
  ipcMain.handle('wechat:downloadUpdate', async (_e, { version }: { version: string }) => {
    return downloadUpdate(version, (progress) => {
      // 发送进度到渲染进程
      mainWindow.webContents.send('wechat:downloadProgress', progress)
    })
  })
  ipcMain.handle('wechat:openExternal', async (_e, { url }: { url: string }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      await shell.openExternal(url)
    }
  })
}
