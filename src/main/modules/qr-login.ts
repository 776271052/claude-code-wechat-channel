// QR Login — fetch QR code and poll scan status (no readline, GUI-driven)

import { BOT_TYPE, DEFAULT_BASE_URL } from './config'
import type { QRCodeResponse, QRStatusResponse, AccountData } from '../../shared/types'
import { saveCredentials } from './credentials'
import { log, logError } from '../utils/logger'

export async function fetchQRCode(baseUrl: string = DEFAULT_BASE_URL): Promise<QRCodeResponse> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(BOT_TYPE)}`,
    base,
  )
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`QR fetch failed: ${res.status}`)
  return (await res.json()) as QRCodeResponse
}

export async function pollQRStatus(baseUrl: string, qrcode: string): Promise<QRStatusResponse> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const url = new URL(
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
    base,
  )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 35_000)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'iLink-App-ClientVersion': '1' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`QR status failed: ${res.status}`)
    return (await res.json()) as QRStatusResponse
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') return { status: 'wait' }
    throw err
  }
}

// Save credentials from a confirmed QR status response
export function saveLoginResult(status: QRStatusResponse, baseUrl: string): AccountData | null {
  if (status.status !== 'confirmed' || !status.ilink_bot_id || !status.bot_token) return null
  const account: AccountData = {
    token: status.bot_token,
    baseUrl: status.baseurl || baseUrl,
    accountId: status.ilink_bot_id,
    userId: status.ilink_user_id,
    savedAt: new Date().toISOString(),
  }
  saveCredentials(account)
  log('✅ 微信连接成功！')
  return account
}
