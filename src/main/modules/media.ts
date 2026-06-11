// Media processing — download, decrypt, extract content from WeChat messages
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { decryptAesEcb, parseAesKey } from './crypto'
import { CDN_BASE_URL, MAX_MEDIA_DOWNLOAD_BYTES, MEDIA_DOWNLOAD_TIMEOUT_MS, MAX_INLINE_TEXT_BYTES, MAX_INLINE_TEXT_CHARS } from './config'
import { MEDIA_CACHE_DIR } from '../utils/paths'
import { log, logError } from '../utils/logger'
import type { WeixinMessage, MessageItem, CDNMedia } from './types'
import type { MediaKind } from './types'
import type { ExtractedContent, ExtractedMedia, IncomingMessageContext } from '../../shared/types'

const TEXT_LIKE_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.tsv', '.xml', '.yaml', '.yml', '.log', '.js', '.ts', '.tsx', '.jsx', '.html', '.css'])

function sanitizeFileName(name: string | undefined, fallback: string): string {
  const raw = name?.trim() || fallback
  const sanitized = raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').slice(0, 120).trim()
  return sanitized || fallback
}

function normalizeMimeType(mime: string | undefined): string | undefined {
  const normalized = mime?.split(';')[0]?.trim().toLowerCase()
  return normalized || undefined
}

function inferMimeFromBuffer(data: Buffer): string | undefined {
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6))) return 'image/gif'
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (data.length >= 4 && data.toString('ascii', 0, 4) === '%PDF') return 'application/pdf'
  if (data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4'
  return undefined
}

function chooseMimeType(preferred: string | undefined, data: Buffer): string | undefined {
  const normalized = normalizeMimeType(preferred)
  if (normalized && normalized !== 'application/octet-stream') return normalized
  return inferMimeFromBuffer(data) ?? normalized
}

function inferExtension(params: { fileName?: string; mimeType?: string; kind: MediaKind }): string {
  const existing = params.fileName ? path.extname(params.fileName) : ''
  if (existing) return existing
  const mime = params.mimeType?.toLowerCase()
  if (mime?.includes('png')) return '.png'
  if (mime?.includes('jpeg') || mime?.includes('jpg')) return '.jpg'
  if (mime?.includes('gif')) return '.gif'
  if (mime?.includes('webp')) return '.webp'
  if (mime?.includes('mp4')) return '.mp4'
  if (mime?.includes('quicktime')) return '.mov'
  if (mime?.startsWith('audio/mpeg')) return '.mp3'
  if (mime?.startsWith('video/mpeg')) return '.mpeg'
  if (mime?.includes('wav')) return '.wav'
  if (mime?.includes('pdf')) return '.pdf'
  if (mime?.includes('json')) return '.json'
  if (mime?.startsWith('text/')) return '.txt'
  switch (params.kind) {
    case 'image': return '.jpg'
    case 'video': return '.mp4'
    case 'voice': return '.mp3'
    case 'file': return '.bin'
  }
}

function buildMediaCachePath(params: { senderId: string; createTimeMs?: number; kind: MediaKind; fileName?: string; mimeType?: string }): string {
  const stamp = String(params.createTimeMs ?? Date.now())
  const date = new Date(Number(stamp))
  const day = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown-date'
  const sender = sanitizeFileName(params.senderId.split('@')[0] || 'unknown', 'unknown')
  const ext = inferExtension(params)
  const baseName = sanitizeFileName(params.fileName, `${params.kind}-${stamp}${ext}`)
  const finalName = path.extname(baseName) ? `${stamp}-${baseName}` : `${stamp}-${baseName}${ext}`
  return path.join(MEDIA_CACHE_DIR(), day, sender, finalName)
}

function buildCdnDownloadUrl(encryptedQueryParam: string): string {
  const url = new URL(`${CDN_BASE_URL}/download`)
  url.searchParams.set('encrypted_query_param', encryptedQueryParam)
  return url.toString()
}

function pickMediaUrl(media: CDNMedia | undefined): { url?: string; usedFullUrl: boolean } {
  if (!media) return { usedFullUrl: false }
  if (media.full_url?.trim()) return { url: media.full_url.trim(), usedFullUrl: true }
  if (media.encrypt_query_param?.trim()) return { url: buildCdnDownloadUrl(media.encrypt_query_param.trim()), usedFullUrl: false }
  return { usedFullUrl: false }
}

async function downloadMedia(url: string): Promise<{ data: Buffer; mimeType?: string }> {
  const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(MEDIA_DOWNLOAD_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`media download failed: HTTP ${res.status}`)
  const contentLength = res.headers.get('content-length')
  if (contentLength) {
    const parsed = Number(contentLength)
    if (Number.isFinite(parsed) && parsed > MAX_MEDIA_DOWNLOAD_BYTES) throw new Error(`media too large: ${parsed} bytes`)
  }
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_MEDIA_DOWNLOAD_BYTES) throw new Error(`media too large: ${data.length} bytes`)
  return { data, mimeType: normalizeMimeType(res.headers.get('content-type') ?? undefined) }
}

function savePrivateMediaFile(filePath: string, data: Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, data)
  try { fs.chmodSync(filePath, 0o600) } catch { /* best-effort */ }
}

function maybeInlineTextFile(params: { filePath: string; data: Buffer; mimeType?: string }): string | undefined {
  if (params.data.length > MAX_INLINE_TEXT_BYTES) return undefined
  const ext = path.extname(params.filePath).toLowerCase()
  const mime = params.mimeType?.toLowerCase() ?? ''
  const textLike = TEXT_LIKE_EXTENSIONS.has(ext) || mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('csv')
  if (!textLike) return undefined
  const text = params.data.toString('utf-8')
  const controlChars = text.match(/[\x00-\x08\x0E-\x1F]/g)?.length ?? 0
  if (controlChars > Math.max(8, text.length * 0.01)) return undefined
  if (text.length <= MAX_INLINE_TEXT_CHARS) return text
  return `${text.slice(0, MAX_INLINE_TEXT_CHARS)}\n\n[内容过长，已截断]`
}

function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined) return undefined
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function parseOptionalNumber(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (!value?.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function compactError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.replace(/\s+/g, ' ').slice(0, 240)
}

function redactUrlForLog(raw: string | undefined): string {
  if (!raw) return ''
  try { const url = new URL(raw); return `${url.origin}${url.pathname}` } catch { return raw.split('?')[0]?.slice(0, 120) ?? '' }
}

function formatMediaText(params: { title: string; media?: ExtractedMedia }): string {
  const lines = [params.title]
  const media = params.media
  if (!media) return lines.join('\n')
  if (media.localPath) lines.push(`本地文件: ${media.localPath}`)
  if (media.fileName) lines.push(`文件名: ${media.fileName}`)
  const formattedBytes = formatBytes(media.bytes)
  if (formattedBytes) lines.push(`大小: ${formattedBytes}`)
  if (media.mimeType) lines.push(`MIME: ${media.mimeType}`)
  if (media.sha256) lines.push(`SHA-256: ${media.sha256}`)
  lines.push(`媒体字段: full_url=${media.source.hasFullUrl} encrypt_query_param=${media.source.hasEncryptQueryParam} aes_key=${media.source.hasAesKey} used_full_url=${media.source.usedFullUrl}`)
  if (!media.download.attempted) lines.push(`处理状态: ${media.download.error ?? '未提供 full_url/encrypt_query_param'}`)
  else if (!media.download.succeeded) lines.push(`处理状态: 下载失败${media.download.error ? `: ${media.download.error}` : ''}`)
  else if (media.decrypt?.attempted && !media.decrypt.succeeded) lines.push(`处理状态: 下载成功，解密失败${media.decrypt.error ? `: ${media.decrypt.error}` : ''}`)
  else if (media.decrypt?.attempted) lines.push('处理状态: 下载成功，解密成功')
  else lines.push('处理状态: 下载成功')
  if (media.inlineText) { lines.push('', '文件内容预览:', media.inlineText) }
  return lines.join('\n')
}

async function processInboundMedia(params: {
  msg: WeixinMessage; senderId: string; kind: MediaKind; media?: CDNMedia; aesKey?: string
  fileName?: string; declaredMimeType?: string; allowPlainDownload: boolean
}): Promise<ExtractedMedia> {
  const { url, usedFullUrl } = pickMediaUrl(params.media)
  const aesKey = params.aesKey?.trim()
  const extractedMedia: ExtractedMedia = {
    kind: params.kind,
    fileName: params.fileName,
    mimeType: normalizeMimeType(params.declaredMimeType),
    source: { hasFullUrl: Boolean(params.media?.full_url), hasEncryptQueryParam: Boolean(params.media?.encrypt_query_param), hasAesKey: Boolean(aesKey), usedFullUrl },
    download: { attempted: Boolean(url), succeeded: false },
    decrypt: aesKey ? { attempted: Boolean(url), succeeded: false } : undefined,
  }
  if (!url) { extractedMedia.download.error = '未提供 full_url/encrypt_query_param'; return extractedMedia }
  if (!aesKey && !params.allowPlainDownload) { extractedMedia.download = { attempted: false, succeeded: false, error: '缺少 AES key' }; return extractedMedia }
  try {
    const downloaded = await downloadMedia(url)
    extractedMedia.download = { attempted: true, succeeded: true }
    let data = downloaded.data
    if (aesKey) {
      const key = parseAesKey(aesKey)
      if (!key) { extractedMedia.decrypt = { attempted: true, succeeded: false, error: 'invalid AES key format' }; return extractedMedia }
      try { data = decryptAesEcb(data, key); extractedMedia.decrypt = { attempted: true, succeeded: true } }
      catch (err) { extractedMedia.decrypt = { attempted: true, succeeded: false, error: compactError(err) }; return extractedMedia }
    }
    extractedMedia.mimeType = chooseMimeType(downloaded.mimeType ?? extractedMedia.mimeType, data)
    const filePath = buildMediaCachePath({ senderId: params.senderId, createTimeMs: params.msg.create_time_ms, kind: params.kind, fileName: params.fileName, mimeType: extractedMedia.mimeType })
    savePrivateMediaFile(filePath, data)
    extractedMedia.localPath = filePath
    extractedMedia.bytes = data.length
    extractedMedia.sha256 = crypto.createHash('sha256').update(data).digest('hex')
    extractedMedia.inlineText = maybeInlineTextFile({ filePath, data, mimeType: extractedMedia.mimeType })
    return extractedMedia
  } catch (err) {
    extractedMedia.download = { attempted: true, succeeded: false, error: compactError(err) }
    logError(`媒体下载失败: kind=${params.kind} url=${redactUrlForLog(url)} error=${extractedMedia.download.error}`)
    return extractedMedia
  }
}

const MSG_ITEM_TEXT = 1
const MSG_ITEM_IMAGE = 2
const MSG_ITEM_VOICE = 3
const MSG_ITEM_FILE = 4
const MSG_ITEM_VIDEO = 5

export async function extractContent(
  msg: WeixinMessage, params: { baseUrl: string; senderId: string },
): Promise<ExtractedContent | null> {
  if (!msg.item_list?.length) return null
  const textParts: string[] = []
  let primaryMedia: ExtractedMedia | undefined
  let primaryMsgType: ExtractedContent['msgType'] = 'unknown'
  for (const item of msg.item_list) {
    switch (item.type) {
      case MSG_ITEM_TEXT: {
        if (!item.text_item?.text) continue
        let text = item.text_item.text
        if (item.ref_msg?.title) text = `[引用: ${item.ref_msg.title}]\n${text}`
        textParts.push(text)
        if (primaryMsgType === 'unknown') primaryMsgType = 'text'
        break
      }
      case MSG_ITEM_VOICE: {
        const voice = item.voice_item
        if (voice?.text) { textParts.push(`[语音转文字] ${voice.text}`); if (primaryMsgType === 'unknown') primaryMsgType = 'voice' }
        else {
          const duration = voice?.playtime ? ` (${voice.playtime}s)` : ''
          const media = await processInboundMedia({ msg, senderId: params.senderId, kind: 'voice', media: voice?.media, aesKey: voice?.media?.aes_key, allowPlainDownload: false })
          textParts.push(formatMediaText({ title: `[语音消息（无文字转录）${duration}]`, media }))
          if (!primaryMedia) { primaryMedia = media; primaryMsgType = 'voice' }
        }
        break
      }
      case MSG_ITEM_IMAGE: {
        const img = item.image_item
        const dims = img?.thumb_width && img?.thumb_height ? ` (缩略图 ${img.thumb_width}×${img.thumb_height})` : ''
        const media = await processInboundMedia({ msg, senderId: params.senderId, kind: 'image', media: img?.media, aesKey: img?.aeskey || img?.media?.aes_key, allowPlainDownload: true })
        textParts.push(formatMediaText({ title: `[图片${dims}]`, media }))
        if (!primaryMedia) { primaryMedia = media; primaryMsgType = 'image' }
        break
      }
      case MSG_ITEM_FILE: {
        const f = item.file_item
        const fileSize = parseOptionalNumber(f?.len)
        const name = f?.file_name ? ` "${f.file_name}"` : ''
        const size = formatBytes(fileSize)
        const media = await processInboundMedia({ msg, senderId: params.senderId, kind: 'file', media: f?.media, aesKey: f?.media?.aes_key, fileName: f?.file_name, allowPlainDownload: false })
        textParts.push(formatMediaText({ title: `[文件${name}${size ? ` (${size})` : ''}]`, media }))
        if (!primaryMedia) { primaryMedia = media; primaryMsgType = 'file' }
        break
      }
      case MSG_ITEM_VIDEO: {
        const v = item.video_item
        const duration = v?.play_length ? ` (${v.play_length}s)` : ''
        const media = await processInboundMedia({ msg, senderId: params.senderId, kind: 'video', media: v?.media, aesKey: v?.media?.aes_key, allowPlainDownload: false })
        textParts.push(formatMediaText({ title: `[视频${duration}]`, media }))
        if (!primaryMedia) { primaryMedia = media; primaryMsgType = 'video' }
        break
      }
      default: textParts.push(`[未知消息类型 ${item.type}]`); break
    }
  }
  if (textParts.length === 0) return null
  return { text: textParts.join('\n'), msgType: primaryMsgType, media: primaryMedia }
}
