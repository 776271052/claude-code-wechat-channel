// Context token cache — persists context tokens across session restarts
import fs from 'node:fs'
import { CREDENTIALS_DIR, CONTEXT_TOKEN_FILE } from '../utils/paths'

let contextTokenCache: Map<string, string> | null = null

function getCache(): Map<string, string> {
  if (!contextTokenCache) {
    try {
      const raw = fs.readFileSync(CONTEXT_TOKEN_FILE(), 'utf-8')
      contextTokenCache = new Map(
        (Object.entries(JSON.parse(raw)) as [string, string][]).filter(
          ([k, v]) => typeof k === 'string' && typeof v === 'string'
        )
      )
    } catch {
      contextTokenCache = new Map()
    }
  }
  return contextTokenCache
}

export function cacheContextToken(key: string, token: string): void {
  const cache = getCache()
  cache.set(key, token)
  try {
    fs.mkdirSync(CREDENTIALS_DIR(), { recursive: true })
    fs.writeFileSync(CONTEXT_TOKEN_FILE(), JSON.stringify(Object.fromEntries(cache), null, 2), 'utf-8')
  } catch { /* best-effort */ }
}

export function getCachedContextToken(key: string): string | undefined {
  return getCache().get(key)
}
