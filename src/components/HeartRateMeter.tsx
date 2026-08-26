// Mesure du pouls via la caméra du téléphone (photopléthysmographie) : le
// doigt posé sur l'objectif module la lumière transmise au rythme des
// battements, on détecte les pics du canal rouge pour estimer le BPM.
// Le flash ne peut pas être piloté depuis Safari iOS (API non supportée) —
// on tente de l'allumer sur les navigateurs qui le permettent (Chrome
// Android) et on prévient sinon.

import { useEffect, useRef, useState } from 'react'
import { HeartPulse, X } from 'lucide-react'

interface Props {
  onMeasured: (bpm: number) => void
  onClose: () => void
}

const MEASURE_MS = 15000
const SAMPLE_MIN_INTERVAL_MS = 40 // ~25 échantillons/s, largement suffisant pour un pouls humain

type Phase = 'starting' | 'measuring' | 'result' | 'error'

export default function HeartRateMeter({ onMeasured, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('starting')
  const [progress, setProgress] = useState(0)
  const [bpm, setBpm] = useState<number | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const samplesRef = useRef<Array<{ t: number; v: number }>>([])
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 64 }, height: { ideal: 64 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
        if (caps?.torch) {
          try {
            await track.applyConstraints({ advanced: [{ torch: true } as unknown as MediaTrackConstraintSet] })
            setTorchOn(true)
          } catch {
            // torche indisponible malgré la capability annoncée — on continue sans
          }
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        samplesRef.current = []
        startRef.current = performance.now()
        setPhase('measuring')
        tick()
      } catch {
        if (!cancelled) {
          setErrorMsg("Impossible d'accéder à la caméra — vérifie les autorisations dans les réglages de Safari/Chrome.")
          setPhase('error')
        }
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      const elapsed = performance.now() - startRef.current

      const last = samplesRef.current[samplesRef.current.length - 1]
      if (!last || performance.now() - last.t >= SAMPLE_MIN_INTERVAL_MS) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          let sum = 0
          for (let i = 0; i < frame.length; i += 4) sum += frame[i]
          const avgRed = sum / (frame.length / 4)
          samplesRef.current.push({ t: performance.now(), v: avgRed })
        }
      }

      setProgress(Math.min(100, (elapsed / MEASURE_MS) * 100))

      if (elapsed < MEASURE_MS) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        finish()
      }
    }

    function finish() {
      const samples = samplesRef.current
      const computed = computeBpm(samples)
      if (computed) {
        setBpm(computed)
        setPhase('result')
      } else {
        setErrorMsg("Signal trop faible ou irrégulier. Assure-toi de bien couvrir l'objectif avec ton doigt, sans bouger.")
        setPhase('error')
      }
      cleanupStream()
    }

    function cleanupStream() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function retry() {
    samplesRef.current = []
    setBpm(null)
    setErrorMsg('')
    setProgress(0)
    setPhase('starting')
    // Le useEffect ne se relance pas tout seul (deps vides) — on force via une clé de remount côté parent serait plus propre,
    // mais un rechargement de page reste simple et fiable ici pour relancer proprement la caméra.
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={32} height={32} className="hidden" />

      <div className="w-full max-w-xs rounded-2xl bg-zinc-950 border border-zinc-800 p-5 text-center">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-500 active:bg-zinc-900">
          <X size={18} />
        </button>

        <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#27272a" strokeWidth="6" />
            {phase === 'measuring' && (
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#ef4444"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - progress / 100)}
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            )}
          </svg>
          <HeartPulse size={36} className={phase === 'measuring' ? 'animate-pulse text-red-500' : 'text-red-500'} />
        </div>

        {phase === 'starting' && <p className="text-sm text-zinc-400">Ouverture de la caméra…</p>}

        {phase === 'measuring' && (
          <>
            <p className="mb-1 text-sm font-medium">Pose ton doigt sur l'objectif</p>
            <p className="text-xs text-zinc-500">
              Couvre bien la caméra {torchOn ? 'et le flash' : ''} à l'arrière du téléphone, reste immobile {Math.ceil((MEASURE_MS - (progress / 100) * MEASURE_MS) / 1000)}s.
            </p>
            {!torchOn && (
              <p className="mt-2 text-[11px] text-zinc-600">
                Le flash ne peut pas être allumé automatiquement sur ce navigateur — allume-le manuellement pour un meilleur résultat.
              </p>
            )}
          </>
        )}

        {phase === 'result' && bpm && (
          <>
            <p className="mb-0.5 text-4xl font-bold tabular-nums text-red-400">{bpm}</p>
            <p className="mb-4 text-xs uppercase tracking-wide text-zinc-500">battements / min</p>
            <div className="flex gap-2">
              <button onClick={retry} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-zinc-300 active:bg-zinc-800">
                Refaire
              </button>
              <button
                onClick={() => onMeasured(bpm)}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-zinc-950 active:bg-red-400"
              >
                Enregistrer
              </button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="mb-4 text-sm text-zinc-400">{errorMsg}</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-zinc-300 active:bg-zinc-800">
                Annuler
              </button>
              <button onClick={retry} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-zinc-950 active:bg-red-400">
                Réessayer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Détrend (moyenne glissante) + détection de pics avec distance minimale
 * (~333ms, soit 180 bpm max) pour estimer le BPM à partir du signal rouge. */
function computeBpm(samples: Array<{ t: number; v: number }>): number | null {
  if (samples.length < 20) return null

  const windowMs = 1000
  const detrended = samples.map((s, i) => {
    const windowSamples = samples.filter((o) => Math.abs(o.t - s.t) <= windowMs / 2)
    const mean = windowSamples.reduce((a, b) => a + b.v, 0) / windowSamples.length
    return { t: s.t, v: s.v - mean, i }
  })

  const minPeakDistanceMs = 333
  const peaks: number[] = []
  for (let i = 2; i < detrended.length - 2; i++) {
    const p = detrended[i]
    if (p.v <= 0.4) continue
    const isLocalMax =
      p.v >= detrended[i - 1].v && p.v >= detrended[i - 2].v && p.v >= detrended[i + 1].v && p.v >= detrended[i + 2].v
    if (!isLocalMax) continue
    const lastPeakT = peaks[peaks.length - 1]
    if (lastPeakT !== undefined && p.t - lastPeakT < minPeakDistanceMs) continue
    peaks.push(p.t)
  }

  if (peaks.length < 5) return null

  const intervals: number[] = []
  for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1])
  intervals.sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]
  const bpm = Math.round(60000 / median)

  if (bpm < 40 || bpm > 200) return null
  return bpm
}
