import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Square, RotateCcw, Loader2, Shield, Terminal, Filter, Bug, AlertCircle, Zap, MessageSquare, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { useBot } from '../hooks/useBot'
import { useMessageStore } from '../stores/message-store'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { cn } from '../lib/utils'
import type { AccountData } from '../../../shared/types'

const api = window.api

const PERMISSION_MODES = [
  { value: 'default', label: '默认', desc: '每次操作都询问', icon: Shield },
  { value: 'acceptEdits', label: '自动编辑', desc: '文件读写自动通过', icon: Terminal },
  { value: 'plan', label: '计划', desc: '只规划不执行', icon: Filter },
  { value: 'auto', label: '自动', desc: '自动执行安全操作', icon: Play },
  { value: 'bypassPermissions', label: '绕过权限', desc: '全部自动通过，危险！', icon: Bug },
]

const BOT_STATE_MAP: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive'; dotColor: string }> = {
  idle: { label: '待机', variant: 'secondary', dotColor: 'bg-gray-400' },
  starting: { label: '启动中', variant: 'warning', dotColor: 'bg-amber-500' },
  running: { label: '运行中', variant: 'success', dotColor: 'bg-emerald-500' },
  stopping: { label: '停止中', variant: 'warning', dotColor: 'bg-amber-500' },
  error: { label: '错误', variant: 'destructive', dotColor: 'bg-red-500' },
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { setAccount, settings, setSettings, permissionMode, setPermissionMode, selectedCliPath, setSelectedCliPath, botState, pollingStatus, errorMessage } = useAppStore()
  const messages = useMessageStore((s) => s.messages)
  const { start, stop, restart } = useBot()
  const [currentTask, setCurrentTask] = useState<{ taskId: string; message: string; elapsed: number } | null>(null)

  useEffect(() => {
    const unsub = api.onTaskStatus((d) => {
      if (d.phase === 'start' || d.phase === 'running' || d.phase === 'progress') setCurrentTask({ taskId: d.taskId, message: d.message, elapsed: d.elapsed ?? 0 })
      else if (d.phase === 'done') setCurrentTask(null)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!currentTask) return
    const id = setInterval(() => setCurrentTask((p) => p ? { ...p, elapsed: p.elapsed + 1 } : null), 1000)
    return () => clearInterval(id)
  }, [currentTask?.taskId])

  useEffect(() => {
    api.loadCredentials().then((cred: AccountData | null) => { if (!cred) navigate('/login'); else setAccount(cred) })
    api.loadSettings().then((s) => { setSettings(s); if (s.cliPath) { setSelectedCliPath(s.cliPath); if (s.permissionMode) setPermissionMode(s.permissionMode) } })
  }, [])

  const handleStart = useCallback(async () => {
    if (settings.mode === 'api' || selectedCliPath) await start()
  }, [settings.mode, selectedCliPath, start])

  const stateInfo = BOT_STATE_MAP[botState] || BOT_STATE_MAP.idle

  const stats = [
    { label: '消息', value: messages.length, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '收到', value: messages.filter((m) => m.direction === 'in').length, icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '发送', value: messages.filter((m) => m.direction === 'out').length, icon: ArrowUpRight, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: '错误', value: messages.filter((m) => m.direction === 'error').length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/50">
      {/* ── Top bar ── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-5">
        <Zap className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-800">控制台</span>
        <div className="h-4 w-px bg-gray-200" />
        <Badge variant={stateInfo.variant} className="gap-1.5 text-xs px-2.5 py-0.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', stateInfo.dotColor, botState === 'running' && 'animate-pulse')} />
          {stateInfo.label}
        </Badge>
        <span className="text-xs text-gray-400 font-mono">
          {settings.mode === 'api' ? settings.model || settings.apiUrl : selectedCliPath?.split(/[/\\]/).pop() || ''}
        </span>
        {currentTask && (
          <div className="flex items-center gap-1.5 ml-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
            <span className="text-xs text-amber-600">{currentTask.message}</span>
            <span className="text-xs text-gray-400">{currentTask.elapsed}s</span>
          </div>
        )}
        <div className="flex-1" />
        {/* Stats inline */}
        <div className="flex items-center gap-1 mr-2">
          {stats.map((s) => (
            <div key={s.label} className={cn('flex items-center gap-1 rounded-md px-2 py-1', s.bg)}>
              <s.icon className={cn('h-3 w-3', s.color)} />
              <span className={cn('text-xs font-semibold', s.color)}>{s.value}</span>
            </div>
          ))}
        </div>
        {botState === 'idle' || botState === 'error' ? (
          (settings.mode === 'api' || selectedCliPath)
            ? <Button size="sm" onClick={handleStart} className="gap-1.5 h-8 text-xs"><Play className="h-3.5 w-3.5" />启动</Button>
            : <Button size="sm" variant="outline" onClick={() => navigate('/cli')} className="gap-1.5 h-8 text-xs"><Terminal className="h-3.5 w-3.5" />配置 CLI</Button>
        ) : botState === 'running' ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={restart} className="gap-1.5 h-8 text-xs"><RotateCcw className="h-3.5 w-3.5" />重启</Button>
            <Button size="sm" variant="destructive" onClick={stop} className="gap-1.5 h-8 text-xs"><Square className="h-3.5 w-3.5" />停止</Button>
          </div>
        ) : (
          <Button size="sm" disabled className="gap-1.5 h-8 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />{stateInfo.label}</Button>
        )}
      </div>

      {errorMessage && <Alert variant="destructive" className="mx-4 mt-2 shrink-0"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-sm">{errorMessage}</AlertDescription></Alert>}

      {/* ── Content ── */}
      <div className="flex flex-1 min-h-0 gap-3 p-3 overflow-hidden">

        {/* ── Left column: Bot Status + Permissions ── */}
        <div className="flex w-72 shrink-0 flex-col gap-3 min-h-0">
          {/* Bot Status */}
          <Card className="shrink-0 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-full flex items-center justify-center',
                  botState === 'running' ? 'bg-emerald-100' : botState === 'error' ? 'bg-red-100' : 'bg-gray-100'
                )}>
                  {botState === 'starting' || botState === 'stopping'
                    ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    : <span className={cn('h-3 w-3 rounded-full', stateInfo.dotColor, botState === 'running' && 'animate-pulse')} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{stateInfo.label}</div>
                  {currentTask ? (
                    <div className="text-xs text-amber-600 mt-0.5 truncate">处理中: {currentTask.message} ({currentTask.elapsed}s)</div>
                  ) : botState === 'running' ? (
                    <div className="text-xs text-gray-400 mt-0.5">等待微信消息...</div>
                  ) : botState === 'idle' ? (
                    <div className="text-xs text-gray-400 mt-0.5">点击启动按钮开始</div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card className="flex flex-1 flex-col min-h-0 border-gray-200">
            <CardHeader className="shrink-0 px-4 py-2.5 pb-2 border-b border-gray-100">
              <CardTitle className="text-xs flex items-center gap-2 text-gray-600">
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                权限模式
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              <div className="space-y-1">
                {PERMISSION_MODES.map((m) => {
                  const selected = permissionMode === m.value
                  const danger = m.value === 'bypassPermissions'
                  return (
                    <button key={m.value} onClick={() => { setPermissionMode(m.value); api.saveSettings({ permissionMode: m.value }) }}
                      className={cn('flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all text-sm',
                        selected
                          ? danger
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-transparent hover:bg-gray-50 text-gray-600'
                      )}>
                      <div className={cn('h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                        selected ? danger ? 'border-red-400' : 'border-blue-400' : 'border-gray-300'
                      )}>
                        {selected && <div className={cn('h-1.5 w-1.5 rounded-full', danger ? 'bg-red-400' : 'bg-blue-400')} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{m.label}</span>
                          {danger && <span className="text-[9px] text-red-500 bg-red-100 rounded px-1 py-0.5">危险</span>}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{m.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: Messages ── */}
        <div className="flex flex-1 flex-col min-h-0 min-w-0">
          <Card className="flex flex-1 flex-col min-h-0 border-gray-200">
            <CardHeader className="shrink-0 px-4 py-2.5 pb-2 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-2 text-gray-600">
                  <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                  最近消息
                </CardTitle>
                <span className="text-[10px] text-gray-400">{messages.length} 条</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <span className="text-xs">暂无消息，启动 Bot 后开始</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {messages.slice(-50).reverse().map((msg) => (
                    <div key={msg.id} className={cn('rounded-lg px-3 py-2 text-xs border',
                      msg.direction === 'in' ? 'bg-white border-gray-100' :
                      msg.direction === 'out' ? 'bg-blue-50/50 border-blue-100/50' :
                      'bg-red-50/50 border-red-100/50'
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-600 text-[11px]">{msg.sender}</span>
                        <span className="text-[10px] text-gray-300">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        {msg.isGroup && <span className="text-[10px] text-blue-400">群聊</span>}
                      </div>
                      <div className="text-gray-600 whitespace-pre-wrap break-words leading-relaxed">{msg.text.slice(0, 150)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
