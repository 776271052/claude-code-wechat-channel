// AES-128-ECB crypto for WeChat CDN media
import crypto from 'node:crypto'

export function decryptAesEcb(data: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

export function parseAesKey(raw: string | undefined): Buffer | null {
  if (!raw?.trim()) return null
  const value = raw.trim()
  const decoded = Buffer.from(value, 'base64')
  if (decoded.length === 16) return decoded
  if (decoded.length === 32) {
    const asciiHex = decoded.toString('ascii')
    if (/^[0-9a-fA-F]{32}$/.test(asciiHex)) return Buffer.from(asciiHex, 'hex')
  }
  if (/^[0-9a-fA-F]{32}$/.test(value)) {
    const hex = Buffer.from(value, 'hex')
    if (hex.length === 16) return hex
  }
  return null
}

export function randomWechatUin(): string {
  return crypto.randomBytes(4).toString('base64')
}

export function generateClientId(): string {
  return `claude-code-wechat:${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}
