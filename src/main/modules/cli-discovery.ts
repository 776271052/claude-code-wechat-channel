// CLI Discovery — find Claude Code CLI on the system
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { SETTINGS_FILE } from '../utils/paths'

export function loadCliPreference(): string | null {
  try {
    if (!fs.existsSync(SETTINGS_FILE())) return null
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf-8'))
    return settings.cliPath ?? null
  } catch { return null }
}

export function saveCliPreference(cliPath: string): void {
  try {
    const settingsPath = SETTINGS_FILE()
    let settings: Record<string, unknown> = {}
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) } catch { /* empty */ }
    settings.cliPath = cliPath
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

export async function probeCliVersion(cliPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(cliPath)) { resolve(null); return }
      const result = spawnSync(cliPath, ['--version'], { timeout: 8000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
      if (result.status === 0 && result.stdout?.trim()) { resolve(result.stdout.trim()) }
      else { resolve(null) }
    } catch { resolve(null) }
  })
}

export function resolveLatestCliPath(savedPath?: string | null): string | null {
  if (savedPath && fs.existsSync(savedPath)) return savedPath
  const candidates = scanForClaudeCli()
  return candidates[0] ?? null
}

export function scanForClaudeCli(): string[] {
  const candidates: string[] = []

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      for (const subdir of ['Claude-3p/claude-code', 'Claude/claude-code']) {
        const root = path.join(localAppData, subdir)
        try {
          const versions = fs.readdirSync(root)
            .filter(n => fs.existsSync(path.join(root, n, 'claude.exe')))
            .sort().reverse()
          if (versions[0]) candidates.push(path.join(root, versions[0], 'claude.exe'))
        } catch { /* ignore */ }
      }
    }
    const appData = process.env.APPDATA
    if (appData) {
      const npmClaude = path.join(appData, 'npm', 'claude.cmd')
      if (fs.existsSync(npmClaude)) candidates.push(npmClaude)
    }
  } else {
    for (const p of ['/usr/local/bin/claude', '/opt/homebrew/bin/claude']) {
      if (fs.existsSync(p)) candidates.push(p)
    }
    const home = process.env.HOME
    if (home) {
      for (const sub of ['.claude/local/claude', '.local/bin/claude']) {
        const p = path.join(home, sub)
        if (fs.existsSync(p)) candidates.push(p)
      }
    }
  }

  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const result = spawnSync(cmd, ['claude'], { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] })
    if (result.status === 0 && result.stdout?.trim()) {
      const found = result.stdout.trim().split(/\r?\n/)[0]?.trim()
      if (found && !candidates.includes(found)) candidates.push(found)
    }
  } catch { /* ignore */ }

  return [...new Set(candidates)]
}

export function diagnoseCliResolution(): Record<string, unknown> {
  const prefContent = loadCliPreference()
  const scanResults = scanForClaudeCli()
  const resolved = resolveLatestCliPath(prefContent)
  const fileExists = resolved ? fs.existsSync(resolved) : false
  const probeResult = resolved ? (() => {
    try {
      const r = spawnSync(resolved, ['--version'], { timeout: 8000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
      return { status: r.status, stdout: r.stdout?.trim() ?? '', stderr: r.stderr?.trim() ?? '', error: r.error?.message ?? '' }
    } catch (e) { return { status: null, stdout: '', stderr: '', error: String(e) } }
  })() : null

  return {
    env: {
      LOCALAPPDATA: process.env.LOCALAPPDATA ?? null,
      APPDATA: process.env.APPDATA ?? null,
    },
    prefContent,
    scanResults,
    resolved,
    fileExists,
    probeResult,
    cwd: process.cwd(),
    execPath: process.execPath,
  }
}
