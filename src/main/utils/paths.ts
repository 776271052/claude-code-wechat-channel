// File system paths — all stored next to the EXE for portability
import path from 'node:path'
import fs from 'node:fs'

// Detect packaged vs dev at call time, not import time
function resolveAppDir(): string {
  // electron-builder portable: ENV points to the real EXE directory
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR
  }
  try {
    const { app } = require('electron')
    if (app.isPackaged) return path.dirname(process.execPath)
  } catch { /* not in electron context */ }
  // Dev mode: go up from node_modules/electron/dist/
  return path.resolve(path.dirname(process.execPath), '..', '..', '..')
}

let _appDir: string | null = null
let _dataDir: string | null = null

function appDir(): string { if (!_appDir) _appDir = resolveAppDir(); return _appDir }
function dataDir(): string { if (!_dataDir) _dataDir = path.join(appDir(), 'data'); return _dataDir }

export const getAppDir = appDir

export const CREDENTIALS_DIR = () => dataDir()
export const CREDENTIALS_FILE = () => path.join(dataDir(), 'account.json')
export const MEDIA_CACHE_DIR = () => path.join(dataDir(), 'media-cache')
export const CONTEXT_TOKEN_FILE = () => path.join(dataDir(), 'context_tokens.json')
export const SYNC_BUF_FILE = () => path.join(dataDir(), 'sync_buf.txt')
export const SETTINGS_FILE = () => path.join(dataDir(), 'gui_settings.json')

export function ensureDirs(): void {
  fs.mkdirSync(dataDir(), { recursive: true })
  fs.mkdirSync(path.join(dataDir(), 'media-cache'), { recursive: true })
}
