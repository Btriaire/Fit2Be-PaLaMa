import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Dumbbell, HeartPulse, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import {
  computeGeneralIndex,
  computeSpecificMuscularIndices,
  computeSpecificCardiacIndices,
  type GeneralProgression,
  type ExerciseIndex,
  type ActivityIndex,
} from '../lib/progression'

function TrendBadge({ trendPct }: { trendPct: number }) {
  if (Math.abs(trendPct) < 1) {
    return (
      <span className="flex items-center gap-0.5 text-zinc-500">
        <Minus size={12} /> stable
      </span>
    )
  }
  const up = trendPct > 0
  return (
    <span className={`flex items-center gap-0.5 ${up ? 'text-teal-400' : 'text-red-400'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}
      {trendPct}%
    </span>
  )
}

function IndexCard({ label, color, score, trendPct, sampleSize, hint }: { label: string; color: string; score: number; trendPct: number; sampleSize: number; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-4xl font-bold" style={{ color }}>
        {sampleSize >= 2 ? score : '—'}
      </p>
      <div className="mt-1 flex items-center justify-center gap-1.5 text-xs">
        {sampleSize >= 2 ? <TrendBadge trendPct={trendPct} /> : <span className="text-zinc-600">{hint ?? 'Pas assez de données'}</span>}
      </div>
    </div>
  )
}

export default function ProgressionPage() {
  const navigate = useNavigate()
  const [general, setGeneral] = useState<GeneralProgression | null>(null)
  const [muscularList, setMuscularList] = useState<ExerciseIndex[]>([])
  const [cardiacList, setCardiacList] = useState<ActivityIndex[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([computeGeneralIndex(), computeSpecificMuscularIndices(), computeSpecificCardiacIndices()]).then(
      ([g, m, c]) => {
        setGeneral(g)
        setMuscularList(m)
        setCardiacList(c)
        setLoading(false)
      },
    )
  }, [])

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <TrendingUp className="text-zinc-300" size={20} />
        <h1 className="text-lg font-semibold tracking-tight">Progression</h1>
      </header>

      {loading && <p className="px-1 text-sm text-zinc-500">Calcul des index…</p>}

      {!loading && general && (
        <>
          <div className="glass mb-5 rounded-2xl p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Indice général</p>
            <p className="mt-1 text-5xl font-bold text-indigo-300">
              {general.general.sampleSize >= 2 ? general.general.score : '—'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Musculation (40%) + Cardio (40%) + Régularité (20%)
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <IndexCard
              label="Indice musculaire"
              color="#e2361c"
              score={general.muscular.score}
              trendPct={general.muscular.trendPct}
              sampleSize={general.muscular.sampleSize}
            />
            <IndexCard
              label="Indice cardiaque"
              color="#2f4bd6"
              score={general.cardiac.score}
              trendPct={general.cardiac.trendPct}
              sampleSize={general.cardiac.sampleSize}
              hint="Ajoute ta FC moyenne"
            />
          </div>

          <div className="glass mb-6 rounded-2xl p-4">
            <p className="text-xs text-zinc-500">Régularité (14 derniers jours)</p>
            <p className="mt-1 text-2xl font-bold text-teal-400">{general.consistency.score}</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">{general.consistency.sampleSize} jour(s) actif(s)</p>
          </div>

          <section className="mb-6">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
              <Dumbbell size={14} className="text-orange-400" /> Index spécifiques — Musculation
            </h2>
            {muscularList.length === 0 && (
              <p className="px-1 text-xs text-zinc-600">Pas encore assez de séances répétées sur un même exercice.</p>
            )}
            <ul className="space-y-1.5">
              {muscularList.map((m) => (
                <li key={m.exerciseId}>
                  <button
                    onClick={() => navigate(`/gym/exercise/${m.exerciseId}`)}
                    className="glass flex w-full items-center justify-between rounded-xl p-3 text-left active:bg-zinc-900/80"
                  >
                    <span className="text-sm">{m.name}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold">{m.index.score}</span>
                      <TrendBadge trendPct={m.index.trendPct} />
                      <ChevronRight size={14} className="text-zinc-600" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
              <HeartPulse size={14} className="text-teal-400" /> Index spécifiques — Cardio
            </h2>
            {cardiacList.length === 0 && (
              <p className="px-1 text-xs text-zinc-600">Ajoute la FC moyenne à tes sorties (ou scanne une machine) pour voir cet index.</p>
            )}
            <ul className="space-y-1.5">
              {cardiacList.map((c) => (
                <li key={c.activityType}>
                  <button
                    onClick={() => navigate(`/endurance/history/${c.activityType}`)}
                    className="glass flex w-full items-center justify-between rounded-xl p-3 text-left active:bg-zinc-900/80"
                  >
                    <span className="text-sm">{c.label}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold">{c.index.score}</span>
                      <TrendBadge trendPct={c.index.trendPct} />
                      <ChevronRight size={14} className="text-zinc-600" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
