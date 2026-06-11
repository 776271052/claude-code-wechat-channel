import { create } from 'zustand'
import type { AccountData, AppSettings, BotStatus, CliCandidate, PollingStatus } from '../../../shared/types'

interface AppState {
  // Auth
  account: AccountData | null
  setAccount: (a: AccountData | null) => void

  // Bot
  botState: BotStatus['state']
  pollingStatus: PollingStatus
  setBotState: (s: BotStatus['state']) => void
  setPollingStatus: (s: PollingStatus) => void

  // CLI
  cliCandidates: CliCandidate[]
  selectedCliPath: string | null
  setCliCandidates: (c: CliCandidate[]) => void
  setSelectedCliPath: (p: string | null) => void

  // Permission
  permissionMode: string
  setPermissionMode: (m: string) => void

  // Settings
  settings: AppSettings
  setSettings: (s: Partial<AppSettings>) => void

  // Error
  errorMessage: string | null
  setErrorMessage: (m: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  account: null,
  setAccount: (account) => set({ account }),

  botState: 'idle',
  pollingStatus: 'disconnected',
  setBotState: (botState) => set({ botState }),
  setPollingStatus: (pollingStatus) => set({ pollingStatus }),

  cliCandidates: [],
  selectedCliPath: null,
  setCliCandidates: (cliCandidates) => set({ cliCandidates }),
  setSelectedCliPath: (selectedCliPath) => set({ selectedCliPath }),

  permissionMode: 'default',
  setPermissionMode: (permissionMode) => set({ permissionMode }),

  settings: {
    mode: 'cli',
    cliPath: '',
    permissionMode: 'default',
    timeoutMs: 600_000,
    workdir: '',
    extraArgs: [],
    apiProtocol: 'openai',
    apiUrl: '',
    apiToken: '',
    model: '',
    apiMaxTokens: 4096,
    apiSystemPrompt: '',
  },
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),

  errorMessage: null,
  setErrorMessage: (errorMessage) => set({ errorMessage }),
}))
