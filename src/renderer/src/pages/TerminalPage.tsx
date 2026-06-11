import { useEffect, useState, useCallback, useRef } from 'react'
import { Terminal, Send, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { cn } from '../lib/utils'

const api = window.api

export default function TerminalPage() {
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubs = [
      api.onCliOutput((d) => {
        const clean = d.data.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
        setLines((prev) => [...prev, ...clean.split(/\r?\n/).filter(Boolean).map(l => `[${d.type === 'stderr' ? 'ERR' : 'OUT'}] ${l}`)].slice(-500))
        setRunning(true)
      }),
      api.onCliExit((d) => {
        setLines((prev) => [...prev, `[SYS] 退出 (code=${d.code})`].slice(-500))
        setRunning(false)
      }),
      api.onTaskStatus((d) => {
        if (d.phase === 'start') setLines((prev) => [...prev, `[${d.taskId}] 收到: ${d.message}`].slice(-500))
        else if (d.phase === 'running') setLines((prev) => [...prev, `[${d.taskId}] 执行中...`].slice(-500))
        else if (d.phase === 'done') { setLines((prev) => [...prev, `[${d.taskId}] ${d.success ? '完成' : '失败'} (${d.elapsed}s)`].slice(-500)); setRunning(false) }
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  // Auto-scroll to bottom when lines change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines.length])

  const handleSend = useCallback(async () => { const t = input.trim(); if (!t) return; setLines((p) => [...p, `[IN] ${t}`].slice(-500)); await api.sendCliInput(t); setInput('') }, [input])

  return (
    <div className="flex h-full flex-col bg-gray-50/50">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4">
        <Terminal className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-800">CLI 终端</span>
        {running && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            运行中
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-1">{lines.length} 行</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setLines([])} className="h-7 w-7 p-0 text-gray-400 hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Terminal */}
      <div className="flex flex-1 min-h-0 flex-col bg-gray-900">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-2 font-mono text-xs leading-relaxed">
          {lines.length === 0 ? (
            <div className="text-gray-500 pt-4">等待输出...</div>
          ) : lines.map((l, i) => (
            <div key={i} className={cn(
              l.startsWith('[ERR]') ? 'text-red-400' :
              l.startsWith('[IN]') ? 'text-cyan-400' :
              l.startsWith('[SYS]') ? 'text-yellow-400' :
              'text-green-300'
            )}>{l}</div>
          ))}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-gray-800 p-2">
          <Input
            placeholder="输入 y/n 或文字发送给 CLI"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            className="flex-1 h-8 font-mono text-xs bg-gray-900 border-gray-700 text-green-300 placeholder:text-gray-600"
          />
          <Button onClick={handleSend} size="sm" className="h-8 gap-1 text-xs">
            <Send className="h-3 w-3" />发送
          </Button>
        </div>
      </div>
    </div>
  )
}
