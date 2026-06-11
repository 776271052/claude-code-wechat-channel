import { useCallback, useEffect } from 'react'
import { useAppStore } from '../stores/app-store'
import { useMessageStore } from '../stores/message-store'

const api = window.api

export function useBot() {
  const { botState, setBotState, setPollingStatus, setErrorMessage, settings, setSettings, setSelectedCliPath } = useAppStore()
  const { addIncoming, addOutgoing, addError } = useMessageStore()

  const buildConfig = useCallback(() => ({
    mode: settings.mode,
    permissionMode: settings.permissionMode,
    cliPath: settings.cliPath,
    timeoutMs: settings.timeoutMs,
    workdir: settings.workdir,
    extraArgs: settings.extraArgs,
    apiProtocol: settings.apiProtocol,
    apiUrl: settings.apiUrl,
    apiToken: settings.apiToken,
    model: settings.model,
    apiMaxTokens: settings.apiMaxTokens,
    apiSystemPrompt: settings.apiSystemPrompt,
  }), [settings])

  const start = useCallback(async () => {
    setBotState('starting')
    setErrorMessage(null)
    try {
      const config = buildConfig()
      await api.saveSettings(config)
      const result = await api.startBot(config)
      // Update store with resolved path so UI stays in sync
      if (result?.resolvedCliPath && result.resolvedCliPath !== settings.cliPath) {
        setSettings({ cliPath: result.resolvedCliPath })
        setSelectedCliPath(result.resolvedCliPath)
      }
      setBotState('running')
    } catch (err) {
      setBotState('error')
      setErrorMessage(String(err))
    }
  }, [buildConfig, setBotState, setErrorMessage, setSettings, setSelectedCliPath])

  const stop = useCallback(async () => {
    setBotState('stopping')
    try {
      await api.stopBot()
      setBotState('idle')
    } catch (err) {
      setBotState('error')
      setErrorMessage(String(err))
    }
  }, [setBotState, setErrorMessage])

  // Subscribe to push events
  useEffect(() => {
    const unsubs = [
      api.onMessageReceived((ctx: any) => {
        addIncoming({
          senderShort: ctx.senderShort || ctx.sender_short || 'unknown',
          text: ctx.extracted?.text || '',
          msgType: ctx.extracted?.msgType || 'unknown',
          isGroup: ctx.isGroup || false,
        })
      }),
      api.onMessageSent((d: { target: string; text: string; chars: number }) => addOutgoing(d)),
      api.onMessageError((d: { target: string; error: string }) => addError(d)),
      api.onPollingStatus((s: string) => setPollingStatus(s as any)),
      api.onBotStopped((d: { reason: string }) => {
        setBotState('idle')
        if (d.reason) setErrorMessage(d.reason)
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [addIncoming, addOutgoing, addError, setBotState, setPollingStatus, setErrorMessage])

  const restart = useCallback(async () => {
    setBotState('stopping')
    setErrorMessage(null)
    try {
      await api.restartBot(buildConfig())
      setBotState('running')
    } catch (err) {
      setBotState('error')
      setErrorMessage(String(err))
    }
  }, [buildConfig, setBotState, setErrorMessage])

  return { start, stop, restart, botState }
}
