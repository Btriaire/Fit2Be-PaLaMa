import { useEffect, useRef, useState } from 'react'
import { Timer, Plus, X } from 'lucide-react'

interface Props {
  durationSec: number
  runToken: number // change this value to (re)start the timer
  onDone?: () => void
}

export default function RestTimer({ durationSec, runToken, onDone }: Props) {
  const [remaining, setRemaining] = useState(0)
  const [active, setActive] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (runToken === 0) return
    setRemaining(durationSec)
    setActive(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken])

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(intervalRef.current!)
          setActive(false)
          if (navigator.vibrate) navigator.vibrate([120, 80, 120])
          doneRef.current?.()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [active])

  if (!active) return null

  const pct = Math.max(0, Math.min(1, remaining / durationSec))
  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60

  return (
    <div className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-3">
        <Timer size={18} className="shrink-0 text-orange-400" />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-orange-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <span className="w-11 shrink-0 text-right font-mono text-sm tabular-nums text-orange-300">
          {mm}:{String(ss).padStart(2, '0')}
        </span>
        <button
          onClick={() => setRemaining((r) => r + 30)}
          className="shrink-0 rounded-full bg-zinc-800 p-1 text-zinc-300 active:bg-zinc-700"
          aria-label="+30s"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => setActive(false)}
          className="shrink-0 rounded-full bg-zinc-800 p-1 text-zinc-400 active:bg-zinc-700"
          aria-label="Passer le repos"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
