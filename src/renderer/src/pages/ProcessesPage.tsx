import { useCallback, useEffect, useState } from 'react'
import { Cpu, Terminal, XCircle, Loader2, Search, Play } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import type { SystemCliProcess } from '../../../shared/types'

const api = window.api

export default function ProcessesPage() {
  const { selectedCliPath, settings, botState, setErrorMessage } = useAppStore()
  const [systemProcs, setSystemProcs] = useState<SystemCliProcess[]>([])
  const [scanningSystem, setScanningSystem] = useState(false)

  // Auto-scan on mount
  useEffect(() => { handleScanSystem() }, [])

  const handleScanSystem = useCallback(async () => { setScanningSystem(true); try { setSystemProcs(await api.scanSystemCliProcesses()) } catch { setSystemProcs([]) } finally { setScanningSystem(false) } }, [])
  const handleKillSystemProc = useCallback(async (pid: number) => { if (await api.killSystemProcess(pid)) setSystemProcs((p) => p.filter((x) => x.pid !== pid)) }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/50">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4">
        <Cpu className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-800">进程管理</span>
        <div className="flex-1" />
        {selectedCliPath && (
          <>
            <Button size="sm" onClick={async () => { try { await api.launchCli({ cliPath: selectedCliPath, cwd: settings?.workdir || undefined, foreground: true }) } catch (e) { setErrorMessage(`启动失败: ${String(e)}`) } }} className="h-8 gap-1.5 text-xs"><Play className="h-3.5 w-3.5" />前台启动</Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await api.launchCli({ cliPath: selectedCliPath, cwd: settings?.workdir || undefined, foreground: false }) } catch (e) { setErrorMessage(`启动失败: ${String(e)}`) } }} className="h-8 gap-1.5 text-xs border-gray-200"><Terminal className="h-3.5 w-3.5" />后台启动</Button>
          </>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden p-3">
        {/* System processes */}
        <Card className="flex flex-1 flex-col min-h-0 border-gray-200 overflow-hidden">
          <CardHeader className="shrink-0 px-4 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm text-gray-700">系统 CLI 进程</CardTitle>
              <Badge variant={systemProcs.length > 0 ? 'warning' : 'secondary'} className="text-xs">{systemProcs.length}</Badge>
              <div className="flex-1" />
              <Button variant="outline" size="sm" disabled={scanningSystem} onClick={handleScanSystem} className="h-7 gap-1.5 text-xs border-gray-200">{scanningSystem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}扫描</Button>
              {systemProcs.length > 0 && <Button variant="destructive" size="sm" onClick={async () => { for (const p of systemProcs) await api.killSystemProcess(p.pid); setSystemProcs([]) }} className="h-7 gap-1.5 text-xs"><XCircle className="h-3.5 w-3.5" />全部终止</Button>}
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
            {systemProcs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
                <Search className="h-8 w-8 opacity-20" />
                <span>{scanningSystem ? '扫描中...' : '未发现系统 CLI 进程'}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {systemProcs.map((proc) => (
                  <div key={proc.pid} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Terminal className="h-4 w-4 text-blue-500" />
                      <span className="font-mono text-sm font-medium">PID {proc.pid}</span>
                      <Badge variant="outline" className="text-xs">{proc.name}</Badge>
                      <div className="flex-1" />
                      <Button variant="destructive" size="sm" onClick={() => handleKillSystemProc(proc.pid)} className="h-6 text-xs gap-1"><XCircle className="h-3 w-3" />终止</Button>
                    </div>
                    <div className="font-mono text-xs text-gray-500 truncate">{proc.commandLine}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
