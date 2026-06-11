import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Wrench, Loader2, Play, Terminal, Globe, AlertCircle, CheckCircle2, XCircle, ExternalLink, Download } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../lib/utils'

const api = window.api

export default function CLIPage() {
  const navigate = useNavigate()
  const { setSettings, selectedCliPath, setSelectedCliPath, cliCandidates, setCliCandidates, settings, setErrorMessage } = useAppStore()
  const [validatingCli, setValidatingCli] = useState(false)
  const [cliValidation, setCliValidation] = useState<string | null>(null)

  useEffect(() => { api.loadSettings().then((s) => { setSettings(s); if (s.cliPath) setSelectedCliPath(s.cliPath) }); api.scanForCli().then(setCliCandidates) }, [])

  const handleValidateCli = useCallback(async () => {
    if (!selectedCliPath) return
    setValidatingCli(true)
    setCliValidation(null)
    try {
      const r = await api.validateCliPath(selectedCliPath)
      setCliValidation(r.valid ? `有效 (${r.version})` : `无效: ${r.error}`)
    } catch (e) {
      setCliValidation(`失败: ${String(e)}`)
    } finally {
      setValidatingCli(false)
    }
  }, [selectedCliPath])

  return (
    <div className="flex h-full flex-col bg-gray-50/50">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4">
        <Wrench className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-800">CLI 配置</span>
        <div className="flex-1" />
        {selectedCliPath && (
          <>
            <Button size="sm" onClick={async () => { try { await api.launchCli({ cliPath: selectedCliPath, cwd: settings?.workdir || undefined, foreground: true }) } catch (e) { setErrorMessage(`启动失败: ${String(e)}`) } }} className="h-7 gap-1 text-xs"><Play className="h-3 w-3" />前台</Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await api.launchCli({ cliPath: selectedCliPath, cwd: settings?.workdir || undefined, foreground: false }) } catch (e) { setErrorMessage(`启动失败: ${String(e)}`) } }} className="h-7 gap-1 text-xs"><Terminal className="h-3 w-3" />后台</Button>
          </>
        )}
      </div>

      {/* API mode notice */}
      {settings.mode === 'api' && (
        <div className="mx-4 mt-3">
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-700">当前使用 API 模式</div>
              <div className="text-xs text-amber-500">CLI 配置不生效，Bot 会使用远程 API 处理消息</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="gap-1.5 text-xs h-7 border-amber-200 text-amber-700 hover:bg-amber-100">
              <Globe className="h-3 w-3" />前往设置
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 min-h-0 gap-3 p-3">
        {/* Candidates - wider */}
        <Card className="flex w-3/5 flex-col min-h-0 border-gray-200">
          <CardHeader className="shrink-0 px-4 py-2.5 border-b border-gray-100">
            <CardTitle className="text-xs text-gray-600">自动发现</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
            {cliCandidates.length > 0 ? (
              <div className="space-y-1">
                {cliCandidates.map((c) => (
                  <button
                    key={c.path}
                    onClick={() => setSelectedCliPath(c.path)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all',
                      selectedCliPath === c.path
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-100 hover:bg-gray-50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs text-gray-700">{c.path}</div>
                      {c.version && <div className="text-xs text-emerald-600 mt-0.5">{c.version}</div>}
                    </div>
                    {c.valid
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <XCircle className="h-4 w-4 text-gray-300 shrink-0" />
                    }
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Download className="h-6 w-6 text-gray-400" />
                </div>
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium text-gray-600">未找到 Claude CLI</div>
                  <div className="text-xs text-gray-400">请先安装 Claude Code CLI，或切换到 API 模式</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.api.openExternal('https://docs.anthropic.com/en/docs/claude-code/overview#install')}
                    className="gap-1.5 text-xs h-8 border-gray-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />下载 CLI
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/settings')}
                    className="gap-1.5 text-xs h-8 border-gray-200"
                  >
                    <Globe className="h-3.5 w-3.5" />切换到 API 模式
                  </Button>
                </div>
                <div className="w-full rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <div className="text-xs font-medium text-gray-600 mb-2">安装方式</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-10 shrink-0">npm</span>
                      <code className="text-[11px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5 font-mono">npm install -g @anthropic-ai/claude-code</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-10 shrink-0">官网</span>
                      <span className="text-[11px] text-blue-600">https://claude.ai/download</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual - narrower */}
        <Card className="flex w-2/5 flex-col min-h-0 border-gray-200">
          <CardHeader className="shrink-0 px-4 py-2.5 border-b border-gray-100">
            <CardTitle className="text-xs text-gray-600">手动配置</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4 px-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">CLI 路径</Label>
              <div className="flex gap-1.5">
                <Input placeholder="/usr/bin/claude" value={selectedCliPath || ''} onChange={(e) => setSelectedCliPath(e.target.value || null)} className="h-9 font-mono text-xs border-gray-200" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-gray-200" onClick={async () => { const r = await api.showOpenDialog({ title: '选择 CLI', filters: [{ name: 'Executable', extensions: ['exe', 'cmd', 'bat', ''] }] }); if (!r.canceled && r.filePaths[0]) setSelectedCliPath(r.filePaths[0]) }}>
                  <FolderOpen className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!selectedCliPath || validatingCli} onClick={handleValidateCli} className="h-8 gap-1.5 text-xs border-gray-200">
                {validatingCli ? <Loader2 className="h-3 w-3 animate-spin" /> : null}校验路径
              </Button>
              {cliValidation && (
                <span className={cn('text-xs flex items-center gap-1', cliValidation.startsWith('有效') ? 'text-emerald-600' : 'text-red-500')}>
                  {cliValidation.startsWith('有效') ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {cliValidation}
                </span>
              )}
            </div>
            {selectedCliPath && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-medium text-gray-600 mb-1">当前选择</div>
                <div className="font-mono text-xs text-gray-500 break-all">{selectedCliPath}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
