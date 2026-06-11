import { create } from 'zustand'

export interface MessageEntry {
  id: string
  direction: 'in' | 'out' | 'error'
  sender: string
  text: string
  msgType: string
  isGroup: boolean
  timestamp: number
}

interface MessageState {
  messages: MessageEntry[]
  addIncoming: (data: { senderShort: string; text: string; msgType: string; isGroup: boolean }) => void
  addOutgoing: (data: { target: string; text: string; chars: number }) => void
  addError: (data: { target: string; error: string }) => void
  clearAll: () => void
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],

  addIncoming: (data) => set((s) => ({
    messages: [...s.messages, {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      direction: 'in',
      sender: data.senderShort,
      text: data.text,
      msgType: data.msgType,
      isGroup: data.isGroup,
      timestamp: Date.now(),
    }],
  })),

  addOutgoing: (data) => set((s) => ({
    messages: [...s.messages, {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      direction: 'out',
      sender: 'Claude',
      text: data.text,
      msgType: 'text',
      isGroup: false,
      timestamp: Date.now(),
    }],
  })),

  addError: (data) => set((s) => ({
    messages: [...s.messages, {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      direction: 'error',
      sender: 'System',
      text: `发送失败: ${data.error}`,
      msgType: 'error',
      isGroup: false,
      timestamp: Date.now(),
    }],
  })),

  clearAll: () => set({ messages: [] }),
}))
