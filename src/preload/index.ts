// Preload bridge — exposes safe IPC methods to renderer
import { contextBridge, ipcRenderer } from 'electron'
import type { AccountData, AppSettings, BotStatus, CliCandidate, ClaudeProcessInfo, LogEntry, QRCodeResponse, QRStatusResponse, StartConfig, SystemCliProcess, UpdateCheckResult } from '../shared/types'

const api = {
  // Request-response
  getStatus: (): Promise<BotStatus> => ipcRenderer.invoke('wechat:getStatus'),
  startBot: (config: StartConfig): Promise<{ resolvedCliPath: string }> => ipcRenderer.invoke('wechat:startBot', config),
  stopBot: (): Promise<void> => ipcRenderer.invoke('wechat:stopBot'),
  restartBot: (config?: StartConfig): Promise<void> => ipcRenderer.invoke('wechat:restartBot', config),
  fetchQRCode: (): Promise<QRCodeResponse> => ipcRenderer.invoke('wechat:fetchQRCode'),
  pollQRStatus: (qrcode: string): Promise<QRStatusResponse> => ipcRenderer.invoke('wechat:pollQRStatus', { qrcode }),
  saveLoginResult: (status: QRStatusResponse): Promise<AccountData | null> => ipcRenderer.invoke('wechat:saveLoginResult', status),
  loadCredentials: (): Promise<AccountData | null> => ipcRenderer.invoke('wechat:loadCredentials'),
  clearCredentials: (): Promise<void> => ipcRenderer.invoke('wechat:clearCredentials'),
  scanForCli: (): Promise<CliCandidate[]> => ipcRenderer.invoke('wechat:scanForCli'),
  validateCliPath: (p: string): Promise<{ valid: boolean; version?: string; error?: string }> => ipcRenderer.invoke('wechat:validateCliPath', { path: p }),
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke('wechat:loadSettings'),
  saveSettings: (s: Partial<AppSettings>): Promise<void> => ipcRenderer.invoke('wechat:saveSettings', s),
  testApiConnection: (opts: { apiUrl: string; apiToken: string; model: string; protocol: string }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('wechat:testApiConnection', opts),
  fetchModels: (opts: { apiUrl: string; apiToken: string; protocol: string }): Promise<{ ok: boolean; models?: string[]; error?: string; unsupported?: boolean }> =>
    ipcRenderer.invoke('wechat:fetchModels', opts),
  showOpenDialog: (opts: { title: string; filters?: Electron.FileFilter[]; properties?: Electron.OpenDialogOptions['properties'] }): Promise<{ canceled: boolean; filePaths: string[] }> => ipcRenderer.invoke('wechat:showOpenDialog', opts),

  // Process management
  getActiveProcesses: (): Promise<ClaudeProcessInfo[]> => ipcRenderer.invoke('wechat:getActiveProcesses'),
  killProcess: (id: string): Promise<boolean> => ipcRenderer.invoke('wechat:killProcess', { id }),
  launchCli: (opts: { cliPath: string; cwd?: string; foreground?: boolean }): Promise<{ success: boolean }> => ipcRenderer.invoke('wechat:launchCli', opts),

  // System CLI process scanning
  scanSystemCliProcesses: (): Promise<SystemCliProcess[]> => ipcRenderer.invoke('wechat:scanSystemCliProcesses'),
  killSystemProcess: (pid: number): Promise<boolean> => ipcRenderer.invoke('wechat:killSystemProcess', { pid }),
  diagnoseCli: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('wechat:diagnoseCli'),
  sendCliInput: (text: string): Promise<boolean> => ipcRenderer.invoke('wechat:sendCliInput', { text }),

  // Updater
  checkForUpdate: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('wechat:checkForUpdate'),
  downloadUpdate: (version: string): Promise<{ success: boolean; filePath?: string; error?: string; oldFilePath?: string; oldDeleted?: boolean; needManualDelete?: boolean; scriptPath?: string; needRestart?: boolean }> =>
    ipcRenderer.invoke('wechat:downloadUpdate', { version }),
  restartForUpdate: (scriptPath: string): Promise<void> =>
    ipcRenderer.invoke('wechat:restartForUpdate', { scriptPath }),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('wechat:openExternal', { url }),

  // Push events — returns unsubscribe function
  onDownloadProgress: (cb: (progress: { percent: number; downloaded: number; total: number; speed: number }) => void): (() => void) => {
    const handler = (_: unknown, data: { percent: number; downloaded: number; total: number; speed: number }) => cb(data)
    ipcRenderer.on('wechat:downloadProgress', handler)
    return () => ipcRenderer.removeListener('wechat:downloadProgress', handler)
  },
  onLogEntry: (cb: (entry: LogEntry) => void): (() => void) => {
    const handler = (_: unknown, data: LogEntry) => cb(data)
    ipcRenderer.on('wechat:logEntry', handler)
    return () => ipcRenderer.removeListener('wechat:logEntry', handler)
  },
  onMessageReceived: (cb: (ctx: unknown) => void): (() => void) => {
    const handler = (_: unknown, data: unknown) => cb(data)
    ipcRenderer.on('wechat:messageReceived', handler)
    return () => ipcRenderer.removeListener('wechat:messageReceived', handler)
  },
  onMessageSent: (cb: (data: { target: string; text: string; chars: number }) => void): (() => void) => {
    const handler = (_: unknown, data: { target: string; text: string; chars: number }) => cb(data)
    ipcRenderer.on('wechat:messageSent', handler)
    return () => ipcRenderer.removeListener('wechat:messageSent', handler)
  },
  onMessageError: (cb: (data: { target: string; error: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { target: string; error: string }) => cb(data)
    ipcRenderer.on('wechat:messageError', handler)
    return () => ipcRenderer.removeListener('wechat:messageError', handler)
  },
  onPollingStatus: (cb: (status: string) => void): (() => void) => {
    const handler = (_: unknown, data: string) => cb(data)
    ipcRenderer.on('wechat:pollingStatus', handler)
    return () => ipcRenderer.removeListener('wechat:pollingStatus', handler)
  },
  onBotStopped: (cb: (data: { reason: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { reason: string }) => cb(data)
    ipcRenderer.on('wechat:botStopped', handler)
    return () => ipcRenderer.removeListener('wechat:botStopped', handler)
  },
  onCliOutput: (cb: (data: { type: string; data: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { type: string; data: string }) => cb(data)
    ipcRenderer.on('wechat:cliOutput', handler)
    return () => ipcRenderer.removeListener('wechat:cliOutput', handler)
  },
  onCliExit: (cb: (data: { code: number | null }) => void): (() => void) => {
    const handler = (_: unknown, data: { code: number | null }) => cb(data)
    ipcRenderer.on('wechat:cliExit', handler)
    return () => ipcRenderer.removeListener('wechat:cliExit', handler)
  },
  onTaskStatus: (cb: (data: { taskId: string; phase: string; message: string; target: string; elapsed?: number; success?: boolean; error?: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { taskId: string; phase: string; message: string; target: string; elapsed?: number; success?: boolean; error?: string }) => cb(data)
    ipcRenderer.on('wechat:taskStatus', handler)
    return () => ipcRenderer.removeListener('wechat:taskStatus', handler)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
