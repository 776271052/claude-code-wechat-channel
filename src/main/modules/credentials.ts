// Credential management — load/save/clear WeChat account data
import fs from 'node:fs'
import type { AccountData } from '../../shared/types'
import { CREDENTIALS_DIR, CREDENTIALS_FILE } from '../utils/paths'
import { log } from '../utils/logger'

export function loadCredentials(): AccountData | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE())) return null
    return JSON.parse(fs.readFileSync(CREDENTIALS_FILE(), 'utf-8')) as AccountData
  } catch { return null }
}

export function saveCredentials(data: AccountData): void {
  fs.mkdirSync(CREDENTIALS_DIR(), { recursive: true })
  fs.writeFileSync(CREDENTIALS_FILE(), JSON.stringify(data, null, 2), 'utf-8')
  try { fs.chmodSync(CREDENTIALS_FILE(), 0o600) } catch { /* best-effort on Windows */ }
  log('凭据已保存')
}

export function clearCredentials(): void {
  try {
    if (fs.existsSync(CREDENTIALS_FILE())) fs.unlinkSync(CREDENTIALS_FILE())
    log('凭据已清除')
  } catch { /* ignore */ }
}
