import { useEffect, useRef, useState } from 'react'
import { Mic, Loader2, Download, AlertCircle } from 'lucide-react'

type PodcastFile = { name: string; mtime: string; sizeKb: number }
type Status = { success: boolean; running: boolean; files: PodcastFile[] }
type PeriodKey = '7d' | '30d' | '90d' | 'all'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '7d', label: 'Semaine' },
  { key: '30d', label: 'Mois' },
  { key: '90d', label: 'Trimestre' },
  { key: 'all', label: 'Depuis le début' },
]

/** Podcast audio de progression, généré côté VPS via NotebookLM (même
 * pipeline que le podcast Nutri-Tracker) — un résumé hebdomadaire tourne
 * déjà tout seul, ce bouton permet aussi d'en relancer un à la demande. */
export default function PodcastPlayer() {
  const [period, setPeriod] = useState<PeriodKey>('7d')
  const [running, setRunning] = useState(false)
  const [latest, setLatest] = useState<PodcastFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/podcast/status', { cache: 'no-store' })
      const data = (await res.json()) as Status
      if (data.success) {
        setRunning(data.running)
        setLatest(data.files?.[0] ?? null)
      }
    } catch {
      // silencieux — VPS injoignable temporairement
    }
  }

  useEffect(() => {
    fetchStatus()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(fetchStatus, 5000)
    } else if (pollRef.current) {
      clearInterval(pollRef.current)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [running])

  async function launch() {
    setError(null)
    try {
      const res = await fetch('/api/podcast/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = (await res.json()) as { success: boolean; error?: string }
      if (data.success) setRunning(true)
      else setError(data.error || 'Échec du lancement')
    } catch {
      setError('VPS injoignable')
    }
  }

  return (
    <div className="glass mb-5 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Mic size={14} className="text-teal-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Podcast de progression</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            disabled={running}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50 ${
              period === p.key ? 'bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/50' : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        onClick={launch}
        disabled={running}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
        style={{
          background: running ? 'rgba(148,163,184,0.1)' : 'linear-gradient(135deg, rgba(45,212,191,0.18), rgba(91,63,196,0.15))',
          border: running ? '1px solid rgba(63,63,70,1)' : '1px solid rgba(45,212,191,0.4)',
          color: running ? '#a1a1aa' : '#2dd4bf',
        }}
      >
        {running ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Génération en cours…
          </>
        ) : (
          <>
            <Mic size={16} /> Générer le podcast maintenant
          </>
        )}
      </button>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {latest && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-500">
              🎙️ Dernier podcast prêt · {new Date(latest.mtime).toLocaleDateString('fr-FR')}
            </span>
            <a href={`/api/podcast/download/${latest.name}`} title="Télécharger" className="text-zinc-500 active:text-zinc-300">
              <Download size={13} />
            </a>
          </div>
          <audio controls preload="none" className="h-8 w-full" src={`/api/podcast/download/${latest.name}?inline=1`} />
        </div>
      )}
    </div>
  )
}
