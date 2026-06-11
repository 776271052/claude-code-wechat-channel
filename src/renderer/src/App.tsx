import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Zap, Settings, Loader2, Download, Terminal, Cpu, Search, Wrench } from 'lucide-react'
import DashboardPage from './pages/DashboardPage'
import TerminalPage from './pages/TerminalPage'
import ProcessesPage from './pages/ProcessesPage'
import CLIPage from './pages/CLIPage'
import DiagPage from './pages/DiagPage'
import SettingsPage from './pages/SettingsPage'
import { useAppStore } from './stores/app-store'
import type { AccountData, UpdateCheckResult } from '../../shared/types'
import { cn } from './lib/utils'

const LoginPage = lazy(() => import('./pages/LoginPage'))

const api = window.api

const NAV_GROUPS = [
  {
    label: '核心',
    items: [
      { path: '/dashboard', label: '控制台', icon: Zap, desc: '状态和权限' },
    ],
  },
  {
    label: '工具',
    items: [
      { path: '/terminal', label: '终端', icon: Terminal, desc: 'CLI 输出' },
      { path: '/processes', label: '进程', icon: Cpu, desc: '运行管理' },
      { path: '/cli', label: 'CLI', icon: Wrench, desc: '路径配置' },
    ],
  },
  {
    label: '系统',
    items: [
      { path: '/diag', label: '诊断', icon: Search, desc: '环境检测' },
      { path: '/settings', label: '设置', icon: Settings, desc: '参数更新' },
    ],
  },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pollingStatus } = useAppStore()
  const [booting, setBooting] = useState(true)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)

  useEffect(() => {
    api.loadCredentials().then((cred: AccountData | null) => {
      if (cred) { if (location.pathname === '/' || location.pathname === '/login') navigate('/dashboard') }
      else navigate('/login')
      setBooting(false)
    })
    api.checkForUpdate().then(setUpdateInfo).catch(() => {})
  }, [])

  if (booting) return (
    <div className="flex h-screen w-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-sm text-gray-400">加载中...</span>
      </div>
    </div>
  )

  if (location.pathname === '/login') return (
    <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-gray-50"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>}>
      <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
    </Suspense>
  )

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    connected: { label: '已连接', color: 'bg-emerald-500' },
    connecting: { label: '连接中', color: 'bg-amber-500 animate-pulse' },
    backoff: { label: '重试中', color: 'bg-amber-500 animate-pulse' },
    disconnected: { label: '未启动', color: 'bg-muted-foreground' },
    error: { label: '连接失败', color: 'bg-destructive' },
  }
  const status = STATUS_MAP[pollingStatus] || STATUS_MAP.disconnected

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* ── Sidebar ── */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Brand */}
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-800">Claude Code</h1>
              <p className="text-[10px] text-gray-400">微信 ClawBot</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.path
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all group',
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
                      <div className="min-w-0 text-left">
                        <div className={cn('text-[13px] font-medium leading-tight', active && 'text-blue-700')}>{item.label}</div>
                        <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{item.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Connection status */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', status.color)} />
            <span className="text-xs text-gray-400">{status.label}</span>
          </div>
        </div>

        {/* Update */}
        {updateInfo?.hasUpdate && (
          <button
            onClick={() => api.openExternal(updateInfo.downloadUrl || updateInfo.releaseUrl)}
            className="border-t border-gray-100 bg-emerald-50 px-4 py-3 text-left hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Download className="h-4 w-4" />
              发现新版本
            </div>
            <div className="text-xs text-emerald-500 mt-0.5">
              {updateInfo.currentVersion} → {updateInfo.latestVersion}
            </div>
          </button>
        )}
      </aside>

      {/* ── Main content ── */}
      <main className="flex flex-1 min-w-0 flex-col overflow-hidden bg-gray-50">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/processes" element={<ProcessesPage />} />
          <Route path="/cli" element={<CLIPage />} />
          <Route path="/diag" element={<DiagPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
