import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Save, LogOut, FolderOpen, Settings as SettingsIcon, Clock, Terminal,
  User, AlertCircle, CheckCircle2, Loader2, FileJson,
  Download, ExternalLink, RefreshCw, Globe, Key, Cpu, Zap
} from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../lib/utils'
import type { AppSettings, LLMMode, UpdateCheckResult } from '../../../shared/types'

const api = window.api

function describeApiError(err: string): string {
  const e = err.toLowerCase()
  if (e.includes('401') || e.includes('403') || e.includes('unauthorized')) return 'API 密钥无效或已过期'
  if (e.includes('404')) return '接口地址不存在，请检查 API URL 是否正确'
  if (e.includes('429') || e.includes('rate')) return '请求过于频繁，请稍后再试'
  if (e.includes('timeout') || e.includes('abort')) return '连接超时，请检查网络或 URL 是否正确'
  if (e.includes('econnrefused') || e.includes('enotfound') || e.includes('fetch failed') || e.includes('network'))
    return '无法连接到服务器，请检查 URL 是否正确'
  if (e.includes('500') || e.includes('502') || e.includes('503') || e.includes('server'))
    return '服务器内部错误，请稍后再试'
  return err
}

type TabKey = 'llm' | 'runtime' | 'update' | 'account'

const TABS: { key: TabKey; label: string; icon: typeof Zap }[] = [
  { key: 'llm', label: 'LLM 配置', icon: Zap },
  { key: 'runtime', label: '运行参数', icon: Clock },
  { key: 'update', label: '检查更新', icon: Download },
  { key: 'account', label: '账号信息', icon: User },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { setSettings, setAccount, account } = useAppStore()
  const [activeTab, setActiveTab] = useState<TabKey>('llm')
  const [localSettings, setLocal] = useState<AppSettings>({
    mode: 'cli', cliPath: '', permissionMode: 'default', timeoutMs: 180_000,
    workdir: '', extraArgs: [], apiProtocol: 'openai', apiUrl: '', apiToken: '',
    model: '', apiMaxTokens: 4096, apiSystemPrompt: '',
  })
  const [saved, setSaved] = useState(false)
  const [showRestartHint, setShowRestartHint] = useState(false)
  const [extraArgsText, setExtraArgsText] = useState('[]')
  const [extraArgsError, setExtraArgsError] = useState<string | null>(null)
  const [validatingCli, setValidatingCli] = useState(false)
  const [cliValidation, setCliValidation] = useState<string | null>(null)
  const [testingApi, setTestingApi] = useState(false)
  const [apiTestResult, setApiTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null)
  const [apiUrlError, setApiUrlError] = useState<string | null>(null)
  const [apiTokenError, setApiTokenError] = useState<string | null>(null)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    api.loadSettings().then((s: AppSettings) => { setLocal(s); setExtraArgsText(JSON.stringify(s.extraArgs, null, 2)) })
    api.loadCredentials().then(setAccount)
  }, [])

  useEffect(() => {
    if (localSettings.mode !== 'api' || !localSettings.apiUrl?.trim() || !localSettings.apiToken?.trim()) { setAvailableModels([]); return }
    const timer = setTimeout(() => {
      setFetchingModels(true); setFetchModelsError(null)
      api.fetchModels({ apiUrl: localSettings.apiUrl, apiToken: localSettings.apiToken, protocol: localSettings.apiProtocol })
        .then((r) => { if (r.ok && r.models?.length) { setAvailableModels(r.models); setFetchModelsError(null) } else { setAvailableModels([]); if (r.error && !r.unsupported) setFetchModelsError(r.error) } })
        .catch((e) => { setFetchModelsError(String(e)) })
        .finally(() => setFetchingModels(false))
    }, 800)
    return () => clearTimeout(timer)
  }, [localSettings.mode, localSettings.apiUrl, localSettings.apiToken, localSettings.apiProtocol])

  const handleSave = async () => {
    if (extraArgsError) return
    if (localSettings.mode === 'api') {
      if (!localSettings.apiUrl?.trim()) { setApiUrlError('API URL 不能为空'); return }
      if (!localSettings.apiToken?.trim()) { setApiTokenError('API Token 不能为空'); return }
    }
    setApiUrlError(null); setApiTokenError(null)
    await api.saveSettings(localSettings); setSettings(localSettings)
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    setShowRestartHint(true); setTimeout(() => setShowRestartHint(false), 5000)
  }

  const handleLogout = async () => { await api.clearCredentials(); setAccount(null); navigate('/login') }

  const handleExtraArgsChange = (text: string) => {
    setExtraArgsText(text)
    try { const p = JSON.parse(text); if (!Array.isArray(p)) { setExtraArgsError('必须是 JSON 数组'); return } setExtraArgsError(null); setLocal({ ...localSettings, extraArgs: p }) } catch { setExtraArgsError('JSON 格式无效') }
  }

  const handleValidateCli = async () => {
    if (!localSettings.cliPath) return; setValidatingCli(true); setCliValidation(null)
    try { const r = await api.validateCliPath(localSettings.cliPath); setCliValidation(r.valid ? `有效 (${r.version})` : `无效: ${r.error || '无法执行'}`) } catch (e) { setCliValidation(`校验失败: ${String(e)}`) } finally { setValidatingCli(false) }
  }

  const handleTestApi = async () => {
    if (!localSettings.apiUrl || !localSettings.apiToken) return; setTestingApi(true); setApiTestResult(null)
    try { setApiTestResult(await api.testApiConnection({ apiUrl: localSettings.apiUrl, apiToken: localSettings.apiToken, model: localSettings.model || 'gpt-4o', protocol: localSettings.apiProtocol })) } catch (e) { setApiTestResult({ ok: false, error: String(e) }) } finally { setTestingApi(false) }
  }

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true); setUpdateError(null)
    try { const r = await api.checkForUpdate(); setUpdateResult(r); if (r.error) setUpdateError(r.error) } catch (e) { setUpdateError(`检查失败: ${String(e)}`) } finally { setCheckingUpdate(false) }
  }

  const setMode = useCallback((mode: LLMMode) => { setLocal((s) => ({ ...s, mode })); setApiTestResult(null) }, [])

  return (
    <div className="flex h-full overflow-hidden bg-gray-50/50">
      {/* ── Left sidebar ── */}
      <div className="w-48 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">设置</span>
          </div>
        </div>
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
                activeTab === tab.key
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              )}
            >
              <tab.icon className={cn('h-4 w-4', activeTab === tab.key ? 'text-blue-600' : 'text-gray-400')} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3 space-y-2">
          <Button onClick={handleSave} disabled={!!extraArgsError} className="w-full gap-1.5 h-8 text-xs">
            {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? '已保存' : '保存设置'}
          </Button>
          {showRestartHint && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-xs text-amber-700">设置已保存，重启应用后生效</span>
            </div>
          )}
          <Button variant="ghost" onClick={handleLogout} className="w-full gap-1.5 h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut className="h-3.5 w-3.5" />退出登录
          </Button>
        </div>
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">

          {/* LLM 配置 */}
          {activeTab === 'llm' && (
            <>
              {/* Mode Toggle */}
              <Section title="LLM 模式" desc="选择使用本地 Claude CLI 或远程 API" icon={Zap}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'cli' as LLMMode, icon: Terminal, label: 'Claude CLI', desc: '本地调用' },
                    { value: 'api' as LLMMode, icon: Globe, label: '远程 API', desc: 'DeepSeek 等' },
                  ].map((m) => (
                    <button key={m.value} onClick={() => setMode(m.value)}
                      className={cn('flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                        localSettings.mode === m.value ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50')}>
                      <m.icon className={cn('h-5 w-5', localSettings.mode === m.value ? 'text-blue-600' : 'text-gray-400')} />
                      <div><div className="text-sm font-medium text-gray-800">{m.label}</div><div className="text-xs text-gray-400">{m.desc}</div></div>
                    </button>
                  ))}
                </div>
              </Section>

              {/* API Config */}
              {localSettings.mode === 'api' && (
                <Section title="API 配置" desc="填写 API 连接信息" icon={Globe}>
                  {/* Protocol */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">接口协议</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'openai' as const, label: 'OpenAI 兼容', desc: 'DeepSeek 等' },
                        { value: 'anthropic' as const, label: 'Anthropic', desc: 'Claude API' },
                      ]).map((p) => (
                        <button key={p.value} onClick={() => setLocal({ ...localSettings, apiProtocol: p.value })}
                          className={cn('rounded-lg border px-3 py-2 text-left transition-all text-sm',
                            localSettings.apiProtocol === p.value ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600')}>
                          <div className="font-medium text-xs">{p.label}</div><div className="text-[11px] text-gray-400">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">快捷选择</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'DeepSeek', url: 'https://api.deepseek.com/v1/chat/completions', protocol: 'openai' as const },
                        { label: '小米 MiMo', url: 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions', protocol: 'openai' as const },
                        { label: 'Anthropic', url: 'https://api.anthropic.com/v1/messages', protocol: 'anthropic' as const },
                        { label: '月之暗面', url: 'https://api.moonshot.cn/v1/chat/completions', protocol: 'openai' as const },
                        { label: '智谱', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', protocol: 'openai' as const },
                        { label: '阿里通义', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', protocol: 'openai' as const },
                      ].map((p) => (
                        <button key={p.label} onClick={() => setLocal({ ...localSettings, apiUrl: p.url, apiProtocol: p.protocol })}
                          className={cn('rounded-md border px-2 py-1 text-xs transition-all',
                            localSettings.apiUrl === p.url ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-500')}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* URL */}
                  <Field label="API 地址" icon={Globe} error={apiUrlError}>
                    <Input value={localSettings.apiUrl} onChange={(e) => setLocal({ ...localSettings, apiUrl: e.target.value })}
                      placeholder={localSettings.apiProtocol === 'anthropic' ? 'https://api.anthropic.com/v1/messages' : 'https://api.deepseek.com/v1/chat/completions'}
                      className={cn('font-mono text-sm', apiUrlError && 'border-red-300')} />
                  </Field>

                  {/* Token */}
                  <Field label="API Token" icon={Key} error={apiTokenError}>
                    <Input type="password" value={localSettings.apiToken}
                      onChange={(e) => { setLocal({ ...localSettings, apiToken: e.target.value }); setApiTokenError(null) }}
                      placeholder="sk-..." className={cn('font-mono text-sm', apiTokenError && 'border-red-300')} />
                  </Field>

                  {/* Model */}
                  <Field label="模型名称" icon={Cpu}
                    action={
                      <Button variant="ghost" size="sm" disabled={!localSettings.apiUrl || !localSettings.apiToken || fetchingModels}
                        onClick={async () => {
                          setFetchingModels(true); setAvailableModels([]); setFetchModelsError(null)
                          try {
                            const r = await api.fetchModels({ apiUrl: localSettings.apiUrl, apiToken: localSettings.apiToken, protocol: localSettings.apiProtocol })
                            if (r.ok && r.models?.length) { setAvailableModels(r.models); if (!localSettings.model) setLocal((s) => ({ ...s, model: r.models![0] })) }
                            else { setAvailableModels([]); if (r.error && !r.unsupported) setFetchModelsError(r.error) }
                          } catch (e) { setFetchModelsError(String(e)) } finally { setFetchingModels(false) }
                        }}
                        className="h-6 gap-1 text-xs text-gray-400 hover:text-gray-600">
                        {fetchingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}获取模型
                      </Button>
                    }>
                    {availableModels.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={localSettings.model && availableModels.includes(localSettings.model) ? localSettings.model : '__custom__'}
                          onChange={(e) => {
                            if (e.target.value !== '__custom__') {
                              setLocal({ ...localSettings, model: e.target.value })
                            }
                          }}
                          className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                          <option value="">-- 请选择 --</option>
                          {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                          <option value="__custom__">自定义...</option>
                        </select>
                        {(!localSettings.model || !availableModels.includes(localSettings.model)) && (
                          <div className="space-y-1">
                            <Input
                              value={localSettings.model}
                              onChange={(e) => setLocal({ ...localSettings, model: e.target.value })}
                              placeholder="输入自定义模型名称"
                              className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-400">输入任意模型名称</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Input value={localSettings.model} onChange={(e) => setLocal({ ...localSettings, model: e.target.value })} placeholder="deepseek-chat" className="font-mono text-sm" />
                        <p className="text-xs text-gray-400">点击「获取模型」自动拉取列表，或手动输入</p>
                      </div>
                    )}
                    {fetchModelsError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{describeApiError(fetchModelsError)}</p>}
                  </Field>

                  {/* Max tokens + system prompt */}
                  <Field label="最大 Token 数">
                    <Input type="number" value={localSettings.apiMaxTokens} onChange={(e) => setLocal({ ...localSettings, apiMaxTokens: Number(e.target.value) || 4096 })} min={256} max={128000} />
                  </Field>
                  <Field label="系统提示词（可选）">
                    <textarea value={localSettings.apiSystemPrompt} onChange={(e) => setLocal({ ...localSettings, apiSystemPrompt: e.target.value })} placeholder="留空使用默认提示词" rows={2}
                      className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 resize-none" />
                  </Field>

                  {/* Test */}
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" disabled={!localSettings.apiUrl || !localSettings.apiToken || testingApi} onClick={handleTestApi} className="gap-1.5 h-8 text-xs border-gray-200">
                      {testingApi ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}测试连接
                    </Button>
                    {apiTestResult && (
                      <span className={cn('text-xs flex items-center gap-1', apiTestResult.ok ? 'text-emerald-600' : 'text-red-500')}>
                        {apiTestResult.ok ? <><CheckCircle2 className="h-3 w-3" />连接成功</> : <><AlertCircle className="h-3 w-3" />{apiTestResult.error ? describeApiError(apiTestResult.error) : '连接失败'}</>}
                      </span>
                    )}
                  </div>
                </Section>
              )}

              {/* CLI Config */}
              {localSettings.mode === 'cli' && (
                <Section title="Claude CLI" desc="指定 CLI 路径，留空自动检测" icon={Terminal}>
                  <Field label="CLI 路径">
                    <div className="flex gap-2">
                      <Input value={localSettings.cliPath} onChange={(e) => setLocal({ ...localSettings, cliPath: e.target.value })} placeholder="留空则自动检测" className="font-mono text-sm" />
                      <Button variant="outline" size="icon" className="shrink-0 border-gray-200"
                        onClick={async () => { const r = await api.showOpenDialog({ title: '选择 Claude CLI' }); if (!r.canceled && r.filePaths[0]) setLocal({ ...localSettings, cliPath: r.filePaths[0] }) }}>
                        <FolderOpen className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={!localSettings.cliPath || validatingCli} onClick={handleValidateCli} className="h-7 gap-1 text-xs border-gray-200">
                        {validatingCli ? <Loader2 className="h-3 w-3 animate-spin" /> : null}校验
                      </Button>
                      {cliValidation && <span className={cn('text-xs', cliValidation.startsWith('有效') ? 'text-emerald-600' : 'text-red-500')}>{cliValidation}</span>}
                    </div>
                  </Field>
                </Section>
              )}
            </>
          )}

          {/* 运行参数 */}
          {activeTab === 'runtime' && (
            <Section title="运行参数" desc="配置 Bot 的运行行为" icon={Clock}>
              <Field label="超时时间 (ms)" hint="单次处理最大等待时间，默认 180000 (3 分钟)">
                <Input type="number" value={localSettings.timeoutMs} onChange={(e) => setLocal({ ...localSettings, timeoutMs: Number(e.target.value) || 30_000 })} min={5000} max={600000} />
              </Field>
              {localSettings.mode === 'cli' && (
                <>
                  <Field label="工作目录">
                    <div className="flex gap-2">
                      <Input value={localSettings.workdir} onChange={(e) => setLocal({ ...localSettings, workdir: e.target.value })} placeholder="留空则使用当前目录" className="font-mono text-sm" />
                      <Button variant="outline" size="icon" className="shrink-0 border-gray-200"
                        onClick={async () => { const r = await api.showOpenDialog({ title: '选择工作目录', properties: ['openDirectory'] }); if (!r.canceled && r.filePaths[0]) setLocal({ ...localSettings, workdir: r.filePaths[0] }) }}>
                        <FolderOpen className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                  </Field>
                  <Field label="额外 CLI 参数" icon={FileJson} hint='JSON 数组，如 ["--model", "sonnet"]' error={extraArgsError}>
                    <Input value={extraArgsText} onChange={(e) => handleExtraArgsChange(e.target.value)} placeholder='["--model", "sonnet"]' className="font-mono text-sm" />
                  </Field>
                </>
              )}
            </Section>
          )}

          {/* 检查更新 */}
          {activeTab === 'update' && (
            <Section title="检查更新" desc="检查是否有新版本可用" icon={Download}>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleCheckUpdate} disabled={checkingUpdate} className="gap-2 h-9 border-gray-200">
                  {checkingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {checkingUpdate ? '检查中...' : '检查更新'}
                </Button>
                {!checkingUpdate && updateResult && !updateResult.hasUpdate && !updateError && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />已是最新版本</span>
                )}
                {updateError && (
                  <span className="flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3.5 w-3.5" />{updateError}
                  </span>
                )}
              </div>

              {/* 无 Release 时的提示 */}
              {updateError && updateError.includes('暂无发布版本') && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <div className="text-sm text-gray-600">
                    当前版本 <span className="font-mono font-medium">{updateResult?.currentVersion || '1.0.0'}</span>，仓库暂无 Release。
                  </div>
                  <div className="text-xs text-gray-400">
                    需要在 GitHub 上创建 Release 并上传 EXE 安装包，才能检测到更新。
                  </div>
                  <Button variant="outline" size="sm" onClick={() => api.openExternal(`https://github.com/${'776271052'}/${'claude-code-wechat-channel'}/releases/new`)} className="gap-1.5 h-8 text-xs border-gray-200">
                    <ExternalLink className="h-3.5 w-3.5" />去创建 Release
                  </Button>
                </div>
              )}

              {updateResult?.hasUpdate && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">发现新版本 {updateResult.latestVersion}</span>
                    <span className="text-xs text-gray-400">(当前: {updateResult.currentVersion})</span>
                  </div>
                  {updateResult.releaseNotes && <div className="max-h-40 overflow-y-auto rounded-md bg-white border border-emerald-100 p-3 text-xs text-gray-600 whitespace-pre-wrap">{updateResult.releaseNotes}</div>}
                  <div className="flex gap-2">
                    {updateResult.downloadUrl && <Button size="sm" onClick={() => api.openExternal(updateResult.downloadUrl!)} className="gap-1.5"><Download className="h-3.5 w-3.5" />下载安装包</Button>}
                    <Button variant="outline" size="sm" onClick={() => api.openExternal('https://github.com/776271052/claude-code-wechat-channel')} className="gap-1.5 border-gray-200"><ExternalLink className="h-3.5 w-3.5" />官网首页</Button>
                  </div>
                </div>
              )}

              {/* 版本信息 */}
              {!updateError && !updateResult?.hasUpdate && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="grid grid-cols-[80px_1fr] gap-y-2 text-xs">
                    <span className="text-gray-400">当前版本</span>
                    <span className="font-mono text-gray-700">{updateResult?.currentVersion || '1.0.0'}</span>
                    <span className="text-gray-400">仓库地址</span>
                    <button onClick={() => api.openExternal('https://github.com/776271052/claude-code-wechat-channel')} className="font-mono text-blue-600 hover:underline text-left">
                      github.com/776271052/claude-code-wechat-channel
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* 账号信息 */}
          {activeTab === 'account' && (
            <Section title="账号信息" desc="当前登录的微信账号" icon={User}>
              {account ? (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="grid grid-cols-[80px_1fr] gap-y-2.5 text-sm">
                    <span className="text-gray-400 text-xs">账号 ID</span>
                    <span className="font-mono text-xs text-gray-700">{account.accountId}</span>
                    <span className="text-gray-400 text-xs">用户 ID</span>
                    <span className="font-mono text-xs text-gray-700">{account.userId || 'N/A'}</span>
                    <span className="text-gray-400 text-xs">登录时间</span>
                    <span className="text-xs text-gray-700">{account.savedAt}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-400 justify-center">
                  <User className="h-4 w-4" />未登录
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Reusable layout components ──

function Section({ title, desc, icon: Icon, children }: { title: string; desc?: string; icon: typeof Zap; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {desc && <p className="text-xs text-gray-400 mt-0.5 ml-6">{desc}</p>}
      </div>
      <div className="space-y-4 pl-6">{children}</div>
    </div>
  )
}

function Field({ label, icon: Icon, hint, error, action, children }: {
  label: string; icon?: typeof Zap; hint?: string; error?: string | null; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs text-gray-500">
          {Icon && <Icon className="h-3.5 w-3.5" />}{label}
        </Label>
        {action}
      </div>
      {children}
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
