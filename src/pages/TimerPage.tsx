// Chrono / minuteur plein écran avec horloge analogique.
// Première version générée par Jarvis (Nemotron 3 Ultra), corrigée à la relecture :
// temps figé à la fin du minuteur, reset au changement de mode, layout sans chevauchement,
// aucun setState synchrone dans un effet.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Flag, Minus, Pause, Play, Plus, RotateCcw, X } from 'lucide-react'

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext: typeof AudioContext
}

type Mode = 'chrono' | 'timer'

const PRESETS = [
  { label: '30 s', ms: 30_000 },
  { label: '1 min', ms: 60_000 },
  { label: '90 s', ms: 90_000 },
  { label: '2 min', ms: 120_000 },
  { label: '5 min', ms: 300_000 },
]

const CX = 500
const pad2 = (n: number) => n.toString().padStart(2, '0')

function formatChrono(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}.${Math.floor((ms % 1000) / 100)}`
}
function formatTimer(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

export default function TimerPage({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('chrono')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(0)
  const [elapsedBase, setElapsedBase] = useState(0)
  const [laps, setLaps] = useState<number[]>([])
  const [timerDuration, setTimerDuration] = useState(60_000)
  const [flash, setFlash] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const isRunning = startedAt !== null
  const elapsed = startedAt !== null ? elapsedBase + (nowMs - startedAt) : elapsedBase
  const remaining = timerDuration - elapsed

  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const liveRef = useRef({ mode, timerDuration, elapsedBase, startedAt, reducedMotion })

  useEffect(() => {
    liveRef.current = { mode, timerDuration, elapsedBase, startedAt, reducedMotion }
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Le contexte audio doit être créé/réveillé dans un geste utilisateur (iOS).
  const unlockAudio = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctor = window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext
        audioRef.current = new Ctor()
      }
      if (audioRef.current.state === 'suspended') void audioRef.current.resume()
    } catch {
      // audio indisponible : on garde vibration + flash
    }
  }, [])

  const beep = useCallback(() => {
    const ctx = audioRef.current
    if (!ctx) return
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 880
      gain.gain.value = 0.1
      osc.connect(gain).connect(ctx.destination)
      const t = ctx.currentTime + i * 0.3
      osc.start(t)
      osc.stop(t + 0.15)
    }
  }, [])

  const finishTimer = useCallback(
    (duration: number) => {
      setElapsedBase(duration)
      setStartedAt(null)
      if (!liveRef.current.reducedMotion) setFlash(true)
      navigator.vibrate?.([200, 100, 200])
      beep()
    },
    [beep],
  )

  // Boucle d'animation : le temps vient de performance.now(), pas d'un compteur de ticks.
  useEffect(() => {
    if (startedAt === null) return
    let raf = requestAnimationFrame(function loop() {
      const t = performance.now()
      setNowMs(t)
      const live = liveRef.current
      if (live.mode === 'timer' && live.startedAt !== null && live.elapsedBase + (t - live.startedAt) >= live.timerDuration) {
        finishTimer(live.timerDuration)
        return
      }
      raf = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(raf)
  }, [startedAt, finishTimer])

  useEffect(() => {
    if (!flash) return
    const id = window.setTimeout(() => setFlash(false), 450)
    return () => window.clearTimeout(id)
  }, [flash])

  // Écran maintenu allumé pendant que ça tourne.
  useEffect(() => {
    if (startedAt === null) return
    let cancelled = false
    ;(async () => {
      try {
        const lock = await navigator.wakeLock?.request('screen')
        if (!lock) return
        if (cancelled) void lock.release().catch(() => {})
        else wakeLockRef.current = lock
      } catch {
        // wake lock refusé (économie d'énergie, onglet caché) : sans gravité
      }
    })()
    return () => {
      cancelled = true
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [startedAt])

  useEffect(
    () => () => {
      void audioRef.current?.close().catch(() => {})
    },
    [],
  )

  function reset() {
    setStartedAt(null)
    setElapsedBase(0)
    setLaps([])
    setFlash(false)
  }

  function switchMode(next: Mode) {
    if (next === mode) return
    reset()
    setMode(next)
  }

  function startPause() {
    unlockAudio()
    if (startedAt !== null) {
      setElapsedBase(elapsedBase + (performance.now() - startedAt))
      setStartedAt(null)
      return
    }
    const t = performance.now()
    // Minuteur terminé : repartir de zéro.
    if (mode === 'timer' && elapsedBase >= timerDuration) setElapsedBase(0)
    setNowMs(t)
    setStartedAt(t)
  }

  function lap() {
    if (mode !== 'chrono' || startedAt === null) return
    setLaps((prev) => [...prev, elapsedBase + (performance.now() - startedAt)])
  }

  function pickPreset(ms: number) {
    reset()
    setTimerDuration(ms)
  }

  function adjust(delta: number) {
    setTimerDuration((d) => Math.max(15_000, d + delta))
  }

  const shown = mode === 'chrono' ? elapsed : Math.max(0, remaining)
  const secs = (shown / 1000) % 60
  const mins = (shown / 60_000) % 60
  const secondAngle = ((secs * 6 - 90) * Math.PI) / 180
  const minuteAngle = (((mins + secs / 60) * 6 - 90) * Math.PI) / 180

  const arcR = 490
  const arcLen = 2 * Math.PI * arcR
  const progress = mode === 'timer' ? Math.max(0, Math.min(1, remaining / timerDuration)) : 0
  const finished = mode === 'timer' && !isRunning && elapsedBase >= timerDuration

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#050509] pt-[env(safe-area-inset-top)] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-red-600 transition-opacity duration-300"
        style={{ opacity: flash ? 0.55 : 0 }}
      />

      <div className="relative flex items-center justify-between px-4 py-3">
        <div className="flex gap-1 rounded-full bg-zinc-900 p-1">
          {(['chrono', 'timer'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`min-h-10 rounded-full px-4 text-sm font-medium transition-colors ${
                mode === m ? 'bg-orange-500 text-zinc-950' : 'text-zinc-400'
              }`}
            >
              {m === 'chrono' ? 'Chrono' : 'Minuteur'}
            </button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-zinc-300">
          <X size={22} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-2">
        <svg viewBox="0 0 1000 1000" className="mx-auto h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Horloge analogique">
          <circle cx={CX} cy={CX} r={496} fill="#0b0a1f" stroke="rgba(125,147,234,0.25)" strokeWidth={2} />
          {mode === 'timer' && (
            <circle
              cx={CX}
              cy={CX}
              r={arcR}
              fill="none"
              stroke="#e2361c"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={arcLen}
              strokeDashoffset={arcLen * (1 - progress)}
              transform={`rotate(-90 ${CX} ${CX})`}
            />
          )}
          {Array.from({ length: 60 }, (_, i) => {
            const a = ((i * 6 - 90) * Math.PI) / 180
            const major = i % 5 === 0
            const r1 = major ? 420 : 445
            return (
              <line
                key={i}
                x1={CX + r1 * Math.cos(a)}
                y1={CX + r1 * Math.sin(a)}
                x2={CX + 465 * Math.cos(a)}
                y2={CX + 465 * Math.sin(a)}
                stroke={major ? '#f4f4f5' : 'rgba(244,244,245,0.4)'}
                strokeWidth={major ? 6 : 3}
              />
            )
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const n = i + 1
            const a = ((n * 30 - 90) * Math.PI) / 180
            return (
              <text key={n} x={CX + 350 * Math.cos(a)} y={CX + 350 * Math.sin(a)} fill="#e4e4e7" fontSize={64} fontFamily="ui-monospace, monospace" textAnchor="middle" dominantBaseline="central">
                {n}
              </text>
            )
          })}
          <text
            x={CX}
            y={660}
            textAnchor="middle"
            fill={finished ? '#ff5a30' : '#fafafa'}
            fontSize={120}
            fontWeight={600}
            fontFamily="ui-monospace, monospace"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {mode === 'chrono' ? formatChrono(elapsed) : formatTimer(remaining)}
          </text>
          <line x1={CX} y1={CX} x2={CX + 300 * Math.cos(minuteAngle)} y2={CX + 300 * Math.sin(minuteAngle)} stroke="#7d93ea" strokeWidth={14} strokeLinecap="round" />
          <line x1={CX - 60 * Math.cos(secondAngle)} y1={CX - 60 * Math.sin(secondAngle)} x2={CX + 430 * Math.cos(secondAngle)} y2={CX + 430 * Math.sin(secondAngle)} stroke="#ff5a30" strokeWidth={5} strokeLinecap="round" />
          <circle cx={CX} cy={CX} r={16} fill="#ff5a30" />
          <circle cx={CX} cy={CX} r={6} fill="#050509" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
        {mode === 'chrono' && laps.length > 0 && (
          <ul className="max-h-24 w-full max-w-sm overflow-y-auto font-mono text-sm tabular-nums text-zinc-300">
            {laps
              .map((total, i) => ({ total, split: total - (laps[i - 1] ?? 0), n: i + 1 }))
              .reverse()
              .map(({ total, split, n }) => (
                <li key={n} className="flex justify-between border-b border-zinc-800 py-1">
                  <span className="text-zinc-500">Tour {n}</span>
                  <span>+{formatChrono(split)}</span>
                  <span className="text-zinc-500">{formatChrono(total)}</span>
                </li>
              ))}
          </ul>
        )}

        {mode === 'timer' && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => adjust(-15_000)} aria-label="Moins 15 secondes" className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-zinc-300">
              <Minus size={20} />
            </button>
            {PRESETS.map((p) => (
              <button
                key={p.ms}
                onClick={() => pickPreset(p.ms)}
                className={`min-h-11 rounded-full px-3.5 text-sm ${timerDuration === p.ms ? 'bg-orange-500 font-semibold text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}
              >
                {p.label}
              </button>
            ))}
            <button onClick={() => adjust(15_000)} aria-label="Plus 15 secondes" className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-zinc-300">
              <Plus size={20} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button onClick={reset} aria-label="Réinitialiser" className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-zinc-200 active:scale-95">
            <RotateCcw size={24} />
          </button>
          <button
            onClick={startPause}
            aria-label={isRunning ? 'Pause' : 'Démarrer'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-400 text-zinc-950 shadow-lg shadow-orange-500/30 active:scale-95"
          >
            {isRunning ? <Pause size={28} /> : <Play size={28} className="ml-0.5" />}
          </button>
          {mode === 'chrono' ? (
            <button onClick={lap} disabled={!isRunning} aria-label="Tour" className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-zinc-200 active:scale-95 disabled:opacity-40">
              <Flag size={22} />
            </button>
          ) : (
            <span className="h-14 w-14" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}
