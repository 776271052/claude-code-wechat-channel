// Logger — writes to stderr AND forwards to renderer via IPC
import type { BrowserWindow } from 'electron'
import type { LogEntry } from '../../shared/types'

let mainWindow: BrowserWindow | null = null

export function setLoggerWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function log(msg: string): void {
  process.stderr.write(`[wechat-channel] ${msg}\n`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    const entry: LogEntry = { level: 'info', message: msg, timestamp: Date.now() }
    mainWindow.webContents.send('wechat:logEntry', entry)
  }
}

export function logError(msg: string): void {
  process.stderr.write(`[wechat-channel] ERROR: ${msg}\n`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    const entry: LogEntry = { level: 'error', message: msg, timestamp: Date.now() }
    mainWindow.webContents.send('wechat:logEntry', entry)
  }
}
