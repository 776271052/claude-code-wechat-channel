import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
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

export interface DownloadProgress {
  percent: number
  downloaded: number
  total: number
  speed: number
}

export interface DownloadResult {
  success: boolean
  filePath?: string
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

/**
 * 下载更新文件
 * @param version 版本号 (如 "1.1.0")
 * @param onProgress 进度回调
 * @returns 下载结果
 */
export async function downloadUpdate(
  version: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<DownloadResult> {
  const fileName = `Claude Code WeChat ${version}.exe`
  const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${encodeURIComponent(fileName)}`

  // 保存到用户下载目录
  const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd()
  const downloadsDir = path.join(homeDir, 'Downloads')
  const filePath = path.join(downloadsDir, fileName)

  log(`开始下载更新: ${downloadUrl}`)
  log(`保存到: ${filePath}`)

  return new Promise((resolve) => {
    const request = https.get(downloadUrl, {
      headers: { 'User-Agent': `${REPO_NAME}-gui` },
    }, (res) => {
      // 处理重定向
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location
        if (redirectUrl) {
          https.get(redirectUrl, {
            headers: { 'User-Agent': `${REPO_NAME}-gui` },
          }, (redirectRes) => {
            handleDownloadResponse(redirectRes, filePath, onProgress, resolve)
          }).on('error', (err) => {
            resolve({ success: false, error: `网络错误: ${err.message}` })
          })
          return
        }
      }

      handleDownloadResponse(res, filePath, onProgress, resolve)
    })

    request.on('error', (err) => {
      resolve({ success: false, error: `网络错误: ${err.message}` })
    })

    request.setTimeout(300000, () => {
      request.destroy()
      resolve({ success: false, error: '下载超时' })
    })
  })
}

function handleDownloadResponse(
  res: any,
  filePath: string,
  onProgress: ((progress: DownloadProgress) => void) | undefined,
  resolve: (result: DownloadResult) => void,
): void {
  if (res.statusCode !== 200) {
    resolve({ success: false, error: `下载失败 (${res.statusCode})` })
    return
  }

  const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
  let downloadedBytes = 0
  let lastTime = Date.now()
  let lastBytes = 0

  // 确保下载目录存在
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const fileStream = fs.createWriteStream(filePath)

  res.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length
    fileStream.write(chunk)

    // 计算进度和速度
    const now = Date.now()
    const elapsed = (now - lastTime) / 1000
    if (elapsed >= 0.5) { // 每 0.5 秒更新一次
      const speed = (downloadedBytes - lastBytes) / elapsed
      const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0

      onProgress?.({
        percent: Math.min(percent, 100),
        downloaded: downloadedBytes,
        total: totalBytes,
        speed,
      })

      lastTime = now
      lastBytes = downloadedBytes
    }
  })

  res.on('end', () => {
    fileStream.end(() => {
      log(`下载完成: ${filePath} (${downloadedBytes} bytes)`)
      resolve({ success: true, filePath })
    })
  })

  res.on('error', (err: Error) => {
    fileStream.destroy()
    // 清理失败的文件
    try { fs.unlinkSync(filePath) } catch { /* ignore */ }
    resolve({ success: false, error: `下载错误: ${err.message}` })
  })
}
