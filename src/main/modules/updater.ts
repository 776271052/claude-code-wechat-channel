import https from 'node:https'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { log, logError } from '../utils/logger'

const REPO_OWNER = '776271052'
const REPO_NAME = 'claude-code-wechat-channel'

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  downloadUrl: string | null
  releaseNotes: string
  publishedAt: string
  error?: string
}

function fetchText(url: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': `${REPO_NAME}-gui` },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchText(res.headers.location!, timeoutMs).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`请求失败 (${res.statusCode})`))
        return
      }
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve(data))
    })
    req.on('error', (e) => reject(new Error(`网络连接失败: ${e.message}`)))
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('连接超时')) })
  })
}

function normalizeVersion(v: string): string {
  return v.replace(/^[vV]/, '').trim()
}

function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a).split('.').map(Number)
  const pb = normalizeVersion(b).split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function getAppVersion(): string {
  try {
    const { app } = require('electron')
    if (app?.getVersion) {
      const v = app.getVersion()
      if (v && v !== '0.0.0') return v
    }
  } catch { /* not in electron */ }

  const candidates = [
    resolve(__dirname, '../../package.json'),
    resolve(__dirname, '../../../package.json'),
    resolve(process.cwd(), 'package.json'),
  ]
  for (const p of candidates) {
    try {
      const v = JSON.parse(fs.readFileSync(p, 'utf-8')).version
      if (v) return v
    } catch { /* next */ }
  }
  return '0.0.0'
}

/**
 * 检查更新：直接从 GitHub 获取 package.json 的版本号
 * 不使用 API，没有频率限制
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getAppVersion()
  const releaseUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`
  const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`

  try {
    log('正在检查更新...')

    // 直接获取远程 package.json，无需 API
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/package.json`
    const raw = await fetchText(rawUrl)
    const pkg = JSON.parse(raw)
    const latestVersion = normalizeVersion(pkg.version || '0.0.0')
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

    log(hasUpdate ? `发现新版本: ${currentVersion} -> ${latestVersion}` : `当前已是最新版本: ${currentVersion}`)

    return {
      hasUpdate,
      currentVersion,
      latestVersion: pkg.version || latestVersion,
      releaseUrl,
      downloadUrl,
      releaseNotes: '',
      publishedAt: '',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError(`检查更新失败: ${msg}`)
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl,
      downloadUrl: null,
      releaseNotes: '',
      publishedAt: '',
      error: msg,
    }
  }
}
