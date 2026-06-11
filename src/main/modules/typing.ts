// Typing indicator — show "typing..." in WeChat with periodic refresh

import { apiFetch } from './wechat-api'
import { CHANNEL_VERSION } from './config'
import type { GetConfigResp } from './types'

async function getTypingTicket(
  baseUrl: string, token: string, toUserId: string, contextToken: string,
): Promise<string | null> {
  try {
    const raw = await apiFetch({
      baseUrl,
      endpoint: 'ilink/bot/getconfig',
      body: JSON.stringify({
        to_user_id: toUserId,
        context_token: contextToken,
        base_info: { channel_version: CHANNEL_VERSION },
      }),
      token,
      timeoutMs: 5_000,
    })
    const resp = JSON.parse(raw) as GetConfigResp
    return resp.typing_ticket ?? null
  } catch {
    return null
  }
}

async function sendTyping(
  baseUrl: string, token: string, toUserId: string, contextToken: string, typingTicket: string,
): Promise<void> {
  await apiFetch({
    baseUrl,
    endpoint: 'ilink/bot/sendtyping',
    body: JSON.stringify({
      to_user_id: toUserId,
      typing_ticket: typingTicket,
      context_token: contextToken,
      base_info: { channel_version: CHANNEL_VERSION },
    }),
    token,
    timeoutMs: 5_000,
  })
}

export async function showTypingIndicator(
  baseUrl: string, token: string, toUserId: string, contextToken: string,
): Promise<void> {
  try {
    const ticket = await getTypingTicket(baseUrl, token, toUserId, contextToken)
    if (ticket) await sendTyping(baseUrl, token, toUserId, contextToken, ticket)
  } catch {
    // typing indicator is best-effort
  }
}

const TYPING_REFRESH_MS = 15_000

interface TypingRefresher {
  stop: () => void
}

export function startTypingRefresher(
  baseUrl: string, token: string, toUserId: string, contextToken: string,
): TypingRefresher {
  let stopped = false
  const refresh = async () => {
    while (!stopped) {
      await new Promise(r => setTimeout(r, TYPING_REFRESH_MS))
      if (stopped) break
      await showTypingIndicator(baseUrl, token, toUserId, contextToken)
    }
  }
  refresh().catch(() => {})
  return { stop: () => { stopped = true } }
}
