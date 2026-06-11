// WeChat ilink API core — apiFetch, getUpdates, sendMessage
import { randomWechatUin, generateClientId } from './crypto'
import { CHANNEL_VERSION, LONG_POLL_TIMEOUT_MS, MSG_TYPE_BOT, MSG_STATE_FINISH, MSG_ITEM_TEXT } from './config'
import type { GetUpdatesResp } from './types'

function buildHeaders(token?: string, body?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', AuthorizationType: 'ilink_bot_token', 'X-WECHAT-UIN': randomWechatUin() }
  if (body) h['Content-Length'] = String(Buffer.byteLength(body, 'utf-8'))
  if (token?.trim()) h.Authorization = `Bearer ${token.trim()}`
  return h
}

export async function apiFetch(p: { baseUrl: string; endpoint: string; body: string; token?: string; timeoutMs: number }): Promise<string> {
  const base = p.baseUrl.endsWith('/') ? p.baseUrl : `${p.baseUrl}/`
  const url = new URL(p.endpoint, base).toString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), p.timeoutMs)
  try {
    const res = await fetch(url, { method: 'POST', headers: buildHeaders(p.token, p.body), body: p.body, signal: controller.signal })
    clearTimeout(timer)
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
    return text
  } catch (err) { clearTimeout(timer); throw err }
}

export async function getUpdates(baseUrl: string, token: string, buf: string): Promise<GetUpdatesResp> {
  try {
    const raw = await apiFetch({ baseUrl, endpoint: 'ilink/bot/getupdates', body: JSON.stringify({ get_updates_buf: buf, base_info: { channel_version: CHANNEL_VERSION } }), token, timeoutMs: LONG_POLL_TIMEOUT_MS })
    return JSON.parse(raw) as GetUpdatesResp
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { ret: 0, msgs: [], get_updates_buf: buf }
    throw err
  }
}

export async function sendTextMessage(baseUrl: string, token: string, to: string, text: string, contextToken: string, retries = 2): Promise<void> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      await apiFetch({ baseUrl, endpoint: 'ilink/bot/sendmessage', body: JSON.stringify({ msg: { from_user_id: '', to_user_id: to, client_id: generateClientId(), message_type: MSG_TYPE_BOT, message_state: MSG_STATE_FINISH, item_list: [{ type: MSG_ITEM_TEXT, text_item: { text } }], context_token: contextToken }, base_info: { channel_version: CHANNEL_VERSION } }), token, timeoutMs: 15_000 })
      return
    } catch (err) { lastErr = err; if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1))) }
  }
  throw lastErr
}
