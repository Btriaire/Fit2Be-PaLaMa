import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Square } from 'lucide-react'

interface Props {
  durationSec: number
  runToken: number // change this value to (re)start the timer
  onDone?: () => void
}

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function RestTimer({ durationSec, runToken, onDone }: Props) {
  const [total, setTotal] = useState(durationSec)
  const [remaining, setRemaining] = useState(0)
  const [active, setActive] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (runToken === 0) return
    setTotal(durationSec)
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

  const pct = Math.max(0, Math.min(1, remaining / total))
  const offset = CIRCUMFERENCE * (1 - pct)
  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60
  const label = mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${ss}s`

  function adjust(delta: number) {
    setRemaining((r) => Math.max(1, r + delta))
    setTotal((t) => Math.max(t, remaining + delta))
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center">
      <div className="pointer-events-auto relative">
        <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <circle cx="66" cy="66" r={RADIUS} fill="rgba(9,9,11,0.92)" stroke="#27272a" strokeWidth="6" />
          <circle
            cx="66"
            cy="66"
            r={RADIUS}
            fill="none"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold tabular-nums text-orange-300">{label}</span>
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">repos</span>
        </div>

        <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2.5">
          <button
            onClick={() => adjust(-15)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 shadow-lg active:bg-zinc-700"
            aria-label="-15s"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setActive(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg active:bg-red-400"
            aria-label="Arrêter le repos"
          >
            <Square size={14} fill="currentColor" />
          </button>
          <button
            onClick={() => adjust(15)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-zinc-950 shadow-lg active:bg-orange-400"
            aria-label="+15s"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
