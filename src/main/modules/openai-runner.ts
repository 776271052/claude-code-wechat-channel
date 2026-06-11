// Universal API runner — supports OpenAI-compatible and Anthropic protocols
import type { ApiProtocol } from '../../shared/types'

interface ApiRunOptions {
  prompt: string
  apiUrl: string
  apiToken: string
  model: string
  timeoutMs: number
  maxTokens: number
  systemPrompt?: string
  protocol: ApiProtocol
  onStdoutChunk?: (chunk: string) => void
}

interface ApiPrintResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}

/** 自动处理用户填的 URL：去掉末尾 / */
function cleanUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, '')
}

/** 从聊天接口 URL 推导模型列表 URL */
function deriveModelsUrl(apiUrl: string): string {
  const base = cleanUrl(apiUrl)
  // https://api.example.com/v1/chat/completions → https://api.example.com/v1/models
  // https://api.example.com/anthropic/v1/messages → https://api.example.com/anthropic/v1/models
  if (base.endsWith('/chat/completions')) return base.replace(/\/chat\/completions$/, '/models')
  if (base.endsWith('/messages')) return base.replace(/\/messages$/, '/models')
  // https://api.example.com/v1 → https://api.example.com/v1/models
  return `${base}/models`
}

// ── OpenAI protocol ──────────────────────────────────────────────────────

async function runOpenAI(opts: ApiRunOptions): Promise<ApiPrintResult> {
  const url = cleanUrl(opts.apiUrl)
  const messages: Array<{ role: string; content: string }> = []
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt })
  messages.push({ role: 'user', content: opts.prompt })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiToken}` },
      body: JSON.stringify({ model: opts.model, messages, max_tokens: opts.maxTokens, stream: true }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { stdout: '', stderr: `HTTP ${res.status}: ${errText.slice(0, 300)}`, exitCode: 1, timedOut: false }
    }
    return readSseStream(res, opts.onStdoutChunk)
  } catch (err) {
    return wrapFetchError(err)
  }
}

// ── Anthropic protocol ───────────────────────────────────────────────────

async function runAnthropic(opts: ApiRunOptions): Promise<ApiPrintResult> {
  const url = cleanUrl(opts.apiUrl)
  const messages: Array<{ role: string; content: string }> = []
  messages.push({ role: 'user', content: opts.prompt })

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages,
    stream: true,
  }
  if (opts.systemPrompt) body.system = opts.systemPrompt

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiToken,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { stdout: '', stderr: `HTTP ${res.status}: ${errText.slice(0, 300)}`, exitCode: 1, timedOut: false }
    }
    return readAnthropicSseStream(res, opts.onStdoutChunk)
  } catch (err) {
    return wrapFetchError(err)
  }
}

// ── Dispatch ─────────────────────────────────────────────────────────────

export async function runApiMode(opts: ApiRunOptions): Promise<ApiPrintResult> {
  if (opts.protocol === 'anthropic') return runAnthropic(opts)
  return runOpenAI(opts)
}

// ── SSE stream readers ───────────────────────────────────────────────────

async function readSseStream(res: Response, onChunk?: (chunk: string) => void): Promise<ApiPrintResult> {
  const reader = res.body?.getReader()
  if (!reader) return { stdout: '', stderr: 'No response body', exitCode: 1, timedOut: false }

  const decoder = new TextDecoder()
  let buffer = ''
  let stdout = ''
  let done = false

  while (!done) {
    const { done: streamDone, value } = await reader.read()
    if (streamDone) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') { done = true; break }
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
          error?: { message?: string }
        }
        if (parsed.error?.message) return { stdout, stderr: `API error: ${parsed.error.message}`, exitCode: 1, timedOut: false }
        const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? ''
        if (delta) { stdout += delta; onChunk?.(delta) }
      } catch { /* skip */ }
    }
  }
  return { stdout, stderr: '', exitCode: 0, timedOut: false }
}

async function readAnthropicSseStream(res: Response, onChunk?: (chunk: string) => void): Promise<ApiPrintResult> {
  const reader = res.body?.getReader()
  if (!reader) return { stdout: '', stderr: 'No response body', exitCode: 1, timedOut: false }

  const decoder = new TextDecoder()
  let buffer = ''
  let stdout = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      try {
        const parsed = JSON.parse(data) as {
          type?: string
          delta?: { type?: string; text?: string }
          error?: { message?: string }
        }
        if (parsed.type === 'error') return { stdout, stderr: `API error: ${parsed.error?.message}`, exitCode: 1, timedOut: false }
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          stdout += parsed.delta.text
          onChunk?.(parsed.delta.text)
        }
      } catch { /* skip */ }
    }
  }
  return { stdout, stderr: '', exitCode: 0, timedOut: false }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function wrapFetchError(err: unknown): ApiPrintResult {
  if (err instanceof Error && err.name === 'TimeoutError') {
    return { stdout: '', stderr: 'API request timed out', exitCode: null, timedOut: true }
  }
  const msg = err instanceof Error ? err.message : String(err)
  return { stdout: '', stderr: `API connection error: ${msg}`, exitCode: null, timedOut: false }
}

/** 获取可用模型列表 */
export async function fetchModels(
  apiUrl: string,
  apiToken: string,
  protocol: ApiProtocol,
): Promise<{ ok: boolean; models?: string[]; error?: string; unsupported?: boolean }> {
  const urls = [deriveModelsUrl(apiUrl)]
  // 兜底：从根域名 /v1/models 尝试（适配小米等代理）
  try {
    const origin = new URL(apiUrl).origin
    const derived = urls[0]
    if (derived !== `${origin}/v1/models`) urls.push(`${origin}/v1/models`)
  } catch { /* ignore */ }

  for (const url of urls) {
    try {
      const headers: Record<string, string> = protocol === 'anthropic'
        ? { 'x-api-key': apiToken, 'anthropic-version': '2023-06-01' }
        : { Authorization: `Bearer ${apiToken}` }
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15_000),
      })
      if (res.ok) {
        const data = await res.json() as { data?: Array<{ id: string }> }
        const models = (data.data ?? []).map((m) => m.id).filter(Boolean).sort()
        if (models.length > 0) return { ok: true, models }
      }
    } catch { /* try next */ }
  }

  return { ok: false, unsupported: true }
}

/** 测试 API 连接 */
export async function testApiConnection(
  apiUrl: string,
  apiToken: string,
  model: string,
  protocol: ApiProtocol,
): Promise<{ ok: boolean; error?: string }> {
  const url = cleanUrl(apiUrl)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (protocol === 'anthropic') {
      headers['x-api-key'] = apiToken
      headers['anthropic-version'] = '2023-06-01'
    } else {
      headers['Authorization'] = `Bearer ${apiToken}`
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
