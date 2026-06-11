import { useState, useCallback, useEffect, useRef } from 'react'

const api = window.api

type QRStatus = 'idle' | 'loading' | 'wait' | 'scanned' | 'confirmed' | 'expired' | 'error'

export function useQRLogin(onSuccess: () => void) {
  const [qrData, setQrData] = useState<{ qrcode: string; qrcode_img_content: string } | null>(null)
  const [status, setStatus] = useState<QRStatus>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchQR = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await api.fetchQRCode()
      setQrData(data)
      setStatus('wait')
    } catch {
      setStatus('error')
    }
  }, [])

  // Polling effect
  useEffect(() => {
    if (status !== 'wait' && status !== 'scanned') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(async () => {
      if (!qrData) return
      try {
        const result = await api.pollQRStatus(qrData.qrcode)
        if (result.status === 'scaned') setStatus('scanned')
        else if (result.status === 'confirmed') {
          // 立即停止轮询，避免重复调用
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
          setStatus('confirmed')
          await api.saveLoginResult(result)
          onSuccess()
        } else if (result.status === 'expired') setStatus('expired')
      } catch { /* ignore, will retry */ }
    }, 1500)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [status, qrData, onSuccess])

  return { qrData, status, fetchQR, refresh: fetchQR }
}
