// Polling — long-poll loop with AbortSignal and EventEmitter
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import { getUpdates } from './wechat-api'
import { showTypingIndicator } from './typing'
import { cacheContextToken, getCachedContextToken } from './context-tokens'
import { extractContent } from './media'
import { MSG_TYPE_USER, MAX_CONSECUTIVE_FAILURES, BACKOFF_DELAY_MS, RETRY_DELAY_MS, MAX_MESSAGES_PER_POLL } from './config'
import { SYNC_BUF_FILE } from '../utils/paths'
import { log, logError } from '../utils/logger'
import type { AccountData, IncomingMessageContext, PollingStatus } from '../../shared/types'
import type { IncomingMessageHandler } from './types'

export async function startPolling(
  account: AccountData,
  handler: IncomingMessageHandler,
  emitter: EventEmitter,
  signal: AbortSignal,
): Promise<void> {
  const { baseUrl, token } = account
  let getUpdatesBuf = ''
  let consecutiveFailures = 0

  try {
    if (fs.existsSync(SYNC_BUF_FILE())) {
      getUpdatesBuf = fs.readFileSync(SYNC_BUF_FILE(), 'utf-8')
      log(`恢复同步状态 (${getUpdatesBuf.length} bytes)`)
    }
  } catch { /* ignore */ }

  log('开始监听微信消息...')
  emitter.emit('statusChange', 'connected' as PollingStatus)

  while (!signal.aborted) {
    try {
      const resp = await getUpdates(baseUrl, token, getUpdatesBuf)

      const isError = (resp.ret !== undefined && resp.ret !== 0) || (resp.errcode !== undefined && resp.errcode !== 0)
      if (isError) {
        consecutiveFailures++
        logError(`getUpdates 失败: ret=${resp.ret} errcode=${resp.errcode} errmsg=${resp.errmsg ?? ''}`)
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          emitter.emit('statusChange', 'backoff' as PollingStatus)
          consecutiveFailures = 0
          await new Promise(r => setTimeout(r, BACKOFF_DELAY_MS))
        } else {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        }
        continue
      }

      consecutiveFailures = 0

      if (resp.get_updates_buf) {
        getUpdatesBuf = resp.get_updates_buf
        try { fs.writeFileSync(SYNC_BUF_FILE(), getUpdatesBuf, 'utf-8') } catch { /* ignore */ }
      }

      for (const msg of (resp.msgs ?? []).slice(0, MAX_MESSAGES_PER_POLL)) {
        if (signal.aborted) break
        if (msg.message_type !== MSG_TYPE_USER) continue

        const senderId = msg.from_user_id ?? 'unknown'
        const extracted = await extractContent(msg, { baseUrl, senderId })
        if (!extracted) continue

        const groupId = msg.group_id
        const isGroup = Boolean(groupId)
        const contextKey = groupId ?? senderId

        if (msg.context_token) {
          cacheContextToken(contextKey, msg.context_token)
          if (isGroup) cacheContextToken(senderId, msg.context_token)
        } else {
          logError(`消息缺少 context_token: from=${senderId}`)
        }

        const contextToken = getCachedContextToken(contextKey)
        const canReply = Boolean(contextToken)
        const senderShort = senderId.split('@')[0] || senderId

        log(`收到${isGroup ? '群' : '私'}消息 [${extracted.msgType}]: from=${senderShort} can_reply=${canReply}`)

        // Fire-and-forget: typing indicator runs in background
        if (canReply && msg.context_token) {
          showTypingIndicator(baseUrl, token, senderId, msg.context_token).catch(() => {})
        }

        const ctx: IncomingMessageContext = {
          extracted, senderId, senderShort, groupId, isGroup,
          replyTarget: isGroup ? (groupId as string) : senderId,
          canReply, contextToken,
        }

        emitter.emit('message', ctx)
        // Non-blocking: enqueue to handler's concurrent pool, don't await
        handler(ctx).catch(err => logError(`消息处理异常: ${String(err)}`))
      }
    } catch (err) {
      consecutiveFailures++
      logError(`轮询异常: ${String(err)}`)
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        emitter.emit('statusChange', 'backoff' as PollingStatus)
        consecutiveFailures = 0
        await new Promise(r => setTimeout(r, BACKOFF_DELAY_MS))
      } else {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      }
    }
  }

  log('轮询已停止')
  emitter.emit('statusChange', 'disconnected' as PollingStatus)
}
