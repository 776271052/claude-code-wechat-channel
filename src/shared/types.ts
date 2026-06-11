// Shared types between main and renderer processes

export type LLMMode = 'cli' | 'api'
export type ApiProtocol = 'openai' | 'anthropic'

export interface AccountData {
  token: string
  baseUrl: string
  accountId: string
  userId?: string
  savedAt: string
}

export interface AppSettings {
  mode: LLMMode
  cliPath: string
  permissionMode: string
  timeoutMs: number
  workdir: string
  extraArgs: string[]
  apiProtocol: ApiProtocol
  apiUrl: string
  apiToken: string
  model: string
  apiMaxTokens: number
  apiSystemPrompt: string
}

export interface CliCandidate {
  path: string
  version?: string
  valid: boolean
}

export type PollingStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'backoff'

export interface BotStatus {
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'error'
  account: AccountData | null
  mode: LLMMode
  permissionMode: string
  cliPath: string | null
  apiUrl: string | null
  pollingStatus: PollingStatus
  errorMessage?: string
}

export interface LogEntry {
  level: 'info' | 'error'
  message: string
  timestamp: number
}

export interface StartConfig {
  mode: LLMMode
  permissionMode: string
  cliPath: string
  timeoutMs: number
  workdir: string
  extraArgs: string[]
  apiProtocol: ApiProtocol
  apiUrl: string
  apiToken: string
  model: string
  apiMaxTokens: number
  apiSystemPrompt: string
}

export interface QRCodeResponse {
  qrcode: string
  qrcode_img_content: string
}

export interface QRStatusResponse {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired'
  bot_token?: string
  ilink_bot_id?: string
  baseurl?: string
  ilink_user_id?: string
}

export type ExtractedMsgType = 'text' | 'voice' | 'image' | 'file' | 'video' | 'unknown'

export interface ExtractedMedia {
  kind: 'image' | 'voice' | 'file' | 'video'
  fileName?: string
  localPath?: string
  bytes?: number
  mimeType?: string
  sha256?: string
  source: {
    hasFullUrl: boolean
    hasEncryptQueryParam: boolean
    hasAesKey: boolean
    usedFullUrl: boolean
  }
  download: { attempted: boolean; succeeded: boolean; error?: string }
  decrypt?: { attempted: boolean; succeeded: boolean; error?: string }
  inlineText?: string
}

export interface ExtractedContent {
  text: string
  msgType: ExtractedMsgType
  media?: ExtractedMedia
}

export interface IncomingMessageContext {
  extracted: ExtractedContent
  senderId: string
  senderShort: string
  groupId?: string
  isGroup: boolean
  replyTarget: string
  canReply: boolean
  contextToken?: string
}

export interface MessageEntry {
  id: string
  direction: 'in' | 'out' | 'error'
  sender: string
  text: string
  msgType: string
  isGroup: boolean
  timestamp: number
}

export interface ClaudeProcessInfo {
  id: string
  pid: number
  status: 'running' | 'exited'
  startedAt: number
  prompt: string
  replyTarget: string
}

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

export interface SystemCliProcess {
  pid: number
  name: string
  commandLine: string
}
