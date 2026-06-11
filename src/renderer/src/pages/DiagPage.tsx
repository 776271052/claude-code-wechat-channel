import { useCallback, useState } from 'react'
import { Search, Loader2, FolderOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'

const api = window.api

export default function DiagPage() {
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagResult, setDiagResult] = useState<Record<string, unknown> | null>(null)

  const handleDiagnose = useCallback(async () => { setDiagnosing(true); try { setDiagResult(await api.diagnoseCli()) } catch { setDiagResult(null) } finally { setDiagnosing(false) } }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card/30 px-4">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">环境诊断</span>
        <div className="flex-1" />
        <Button size="sm" disabled={diagnosing} onClick={handleDiagnose} className="h-7 gap-1 text-xs">
          {diagnosing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}开始诊断
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {!diagResult ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">点击上方按钮开始环境诊断</div>
        ) : (() => {
          const env = diagResult.env as Record<string, string | null>
          const scan = diagResult.scanResults as string[]
          const probe = diagResult.probeResult as Record<string, unknown> | null

          return (
            <div className="grid grid-cols-2 gap-3">
              {/* Environment */}
              <Card>
                <CardHeader className="px-4 py-2"><CardTitle className="text-xs">环境变量</CardTitle></CardHeader>
                <CardContent className="px-4 pb-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">LOCALAPPDATA</span><span className="font-mono text-xs">{env?.LOCALAPPDATA ?? '(未设置)'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">APPDATA</span><span className="font-mono text-xs">{env?.APPDATA ?? '(未设置)'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">工作目录</span><span className="font-mono text-xs">{String(diagResult.cwd)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">可执行文件</span><span className="font-mono text-xs truncate max-w-[200px]">{String(diagResult.execPath)}</span></div>
                </CardContent>
              </Card>

              {/* Scan results */}
              <Card>
                <CardHeader className="px-4 py-2"><CardTitle className="text-xs">CLI 扫描结果</CardTitle></CardHeader>
                <CardContent className="px-4 pb-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">保存路径</span><span className="font-mono text-xs">{(diagResult.prefContent as string) || '(空)'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">扫描到</span><span className="text-xs">{scan?.length === 0 ? '未找到' : `${scan?.length} 个`}</span></div>
                  {scan?.map((c, i) => <div key={i} className="font-mono text-xs text-muted-foreground pl-2 truncate">{c}</div>)}
                </CardContent>
              </Card>

              {/* Resolution */}
              <Card>
                <CardHeader className="px-4 py-2"><CardTitle className="text-xs">路径解析</CardTitle></CardHeader>
                <CardContent className="px-4 pb-2 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">最终路径</span><span className={cn('font-mono text-xs', diagResult.resolved ? 'text-emerald-400' : 'text-destructive')}>{(diagResult.resolved as string) ?? 'null'}</span></div>
                  <div className="flex items-center gap-2"><span className="text-muted-foreground">文件存在</span><Badge variant={diagResult.fileExists ? 'success' : 'destructive'} className="text-[10px]">{String(diagResult.fileExists)}</Badge></div>
                </CardContent>
              </Card>

              {/* Probe */}
              <Card>
                <CardHeader className="px-4 py-2"><CardTitle className="text-xs">版本检测</CardTitle></CardHeader>
                <CardContent className="px-4 pb-2 space-y-1 text-xs">
                  {probe ? (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">状态</span><Badge variant={probe.stdout ? 'success' : 'destructive'} className="text-[10px]">{probe.stdout ? '成功' : '失败'}</Badge></div>
                      {probe.stdout && <div className="flex justify-between"><span className="text-muted-foreground">版本</span><span className="font-mono text-emerald-400 text-xs">{String(probe.stdout)}</span></div>}
                      {!probe.stdout && <div className="flex justify-between"><span className="text-muted-foreground">错误</span><span className="text-destructive text-xs">{String(probe.stderr || probe.error)}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">退出码</span><span className="font-mono text-xs">{String(probe.status)}</span></div>
                    </>
                  ) : <div className="text-muted-foreground">未检测</div>}
                </CardContent>
              </Card>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
