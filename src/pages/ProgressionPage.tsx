import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Dumbbell, HeartPulse, TrendingDown, TrendingUp, Minus, Gauge, Shuffle, Wind, Flame, Battery } from 'lucide-react'
import {
  computeGeneralIndex,
  computeSpecificMuscularIndices,
  computeSpecificCardiacIndices,
  computePrRateIndex,
  computeVo2Max,
  computePolarization,
  computeCardioLoadCumulative,
  computeDiversityIndex,
  computeEnergyBalanceTrend,
  computeBodyBatteryTrend,
  type GeneralProgression,
  type ExerciseIndex,
  type ActivityIndex,
  type ProgressionIndex,
  type Vo2MaxEstimate,
  type Polarization,
  type DiversityIndex,
  type EnergyBalanceTrend,
  type BodyBatteryTrend,
} from '../lib/progression'
import { computeAcwr, type Acwr, type AcwrRisk } from '../lib/recovery'
import { getMuscleGroupVolume, getMuscleGroupFreshness, type MuscleGroupStat, type MuscleGroupFreshness } from '../lib/workouts'
import { getSettings } from '../lib/settings'

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

const ACWR_COLOR: Record<AcwrRisk, string> = {
  'sous-charge': '#2f4bd6',
  optimal: '#2dd4bf',
  'à surveiller': '#facc15',
  'risque élevé': '#e2361c',
}

export default function ProgressionPage() {
  const navigate = useNavigate()
  const settings = getSettings()
  const [general, setGeneral] = useState<GeneralProgression | null>(null)
  const [muscularList, setMuscularList] = useState<ExerciseIndex[]>([])
  const [cardiacList, setCardiacList] = useState<ActivityIndex[]>([])
  const [prRate, setPrRate] = useState<ProgressionIndex | null>(null)
  const [acwr, setAcwr] = useState<Acwr | null>(null)
  const [vo2max, setVo2max] = useState<Vo2MaxEstimate | null>(null)
  const [polarization, setPolarization] = useState<Polarization | null>(null)
  const [cardioLoad, setCardioLoad] = useState<{ load7d: number; load28d: number } | null>(null)
  const [diversity, setDiversity] = useState<DiversityIndex | null>(null)
  const [energyBalance, setEnergyBalance] = useState<EnergyBalanceTrend | null>(null)
  const [bbTrend, setBbTrend] = useState<BodyBatteryTrend | null>(null)
  const [muscleVolume, setMuscleVolume] = useState<MuscleGroupStat[]>([])
  const [muscleFreshness, setMuscleFreshness] = useState<MuscleGroupFreshness[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      computeGeneralIndex(),
      computeSpecificMuscularIndices(),
      computeSpecificCardiacIndices(),
      computePrRateIndex(),
      computeAcwr(settings.ageYears),
      computeVo2Max(settings.ageYears, settings.restingHeartRateBpm),
      computePolarization(),
      computeCardioLoadCumulative(settings.ageYears),
      computeDiversityIndex(),
      computeEnergyBalanceTrend(settings),
      computeBodyBatteryTrend(),
      getMuscleGroupVolume(7),
      getMuscleGroupFreshness(),
    ]).then(([g, m, c, pr, ac, vo2, pol, cl, div, eb, bb, mv, mf]) => {
      setGeneral(g)
      setMuscularList(m)
      setCardiacList(c)
      setPrRate(pr)
      setAcwr(ac)
      setVo2max(vo2)
      setPolarization(pol)
      setCardioLoad(cl)
      setDiversity(div)
      setEnergyBalance(eb)
      setBbTrend(bb)
      setMuscleVolume(mv)
      setMuscleFreshness(mf)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <p className="mt-1 text-xs text-zinc-500">Musculation (40%) + Cardio (40%) + Régularité (20%)</p>
          </div>

          {acwr && (
            <div className="glass mb-5 rounded-2xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <Gauge size={13} /> Charge aiguë/chronique (ACWR)
                </h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: `${ACWR_COLOR[acwr.risk]}22`, color: ACWR_COLOR[acwr.risk] }}
                >
                  {acwr.risk}
                </span>
              </div>
              <p className="text-3xl font-bold" style={{ color: ACWR_COLOR[acwr.risk] }}>
                {acwr.ratio ?? '—'}
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">
                Charge 7j : {acwr.acute} pts/j · Charge 28j : {acwr.chronic} pts/j — zone saine ≈ 0.8-1.3
              </p>
            </div>
          )}

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

          <div className="mb-6 grid grid-cols-2 gap-2">
            <div className="glass rounded-2xl p-4">
              <p className="text-xs text-zinc-500">Régularité (14j)</p>
              <p className="mt-1 text-2xl font-bold text-teal-400">{general.consistency.score}</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">{general.consistency.sampleSize} jour(s) actif(s)</p>
            </div>
            {diversity && (
              <div className="glass rounded-2xl p-4">
                <p className="flex items-center gap-1 text-xs text-zinc-500">
                  <Shuffle size={11} /> Diversité (14j)
                </p>
                <p className="mt-1 text-2xl font-bold text-indigo-300">{diversity.score}</p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  Gym {diversity.gymMin}min · Endurance {diversity.enduranceMin}min · Activités {diversity.activityMin}min
                </p>
              </div>
            )}
          </div>

          {bbTrend?.avg7d != null && (
            <div className="glass mb-5 rounded-2xl p-4">
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Battery size={13} className="text-indigo-300" /> Body Battery — moyenne 7j
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-indigo-300">{bbTrend.avg7d}</p>
                {bbTrend.deltaPct != null && (
                  <span className={`text-xs ${bbTrend.deltaPct >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                    {bbTrend.deltaPct >= 0 ? '+' : ''}
                    {bbTrend.deltaPct}% vs semaine précédente
                  </span>
                )}
              </div>
            </div>
          )}

          {energyBalance && (
            <div className="glass mb-6 rounded-2xl p-4">
              <p className="text-xs text-zinc-500">Balance énergétique — moyenne 7j</p>
              <p className={`mt-1 text-2xl font-bold ${energyBalance.avgBalance7d > 0 ? 'text-orange-400' : 'text-teal-400'}`}>
                {energyBalance.avgBalance7d >= 0 ? '+' : ''}
                {energyBalance.avgBalance7d} kcal/j
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-600">Consommées − brûlées (nutrition, gym, activités, endurance)</p>
            </div>
          )}

          <section className="mb-6">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
              <Wind size={14} className="text-teal-400" /> Profil cardio
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {vo2max ? (
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs text-zinc-500">VO2max estimé</p>
                  <p className="mt-1 text-2xl font-bold text-teal-400">{vo2max.vo2max}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    ml/kg/min · FC max {vo2max.source} : {vo2max.hrMaxUsed} bpm
                  </p>
                </div>
              ) : (
                <div className="glass rounded-2xl p-4 text-center">
                  <p className="text-xs text-zinc-500">VO2max estimé</p>
                  <p className="mt-2 text-xs text-zinc-600">Renseigne ta FC de repos dans Réglages</p>
                </div>
              )}
              {cardioLoad && (
                <div className="glass rounded-2xl p-4">
                  <p className="text-xs text-zinc-500">Charge cardio cumulée</p>
                  <p className="mt-1 text-2xl font-bold text-teal-400">{cardioLoad.load7d}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-600">pts/7j · {cardioLoad.load28d} pts/28j</p>
                </div>
              )}
            </div>

            {polarization && (
              <div className="glass mt-2 rounded-2xl p-4">
                <p className="mb-2 text-xs text-zinc-500">Polarisation (28j) — modèle 80/20 recommandé</p>
                <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
                  <div className="bg-teal-500" style={{ width: `${polarization.easyPct}%` }} />
                  <div className="bg-yellow-400" style={{ width: `${polarization.moderatePct}%` }} />
                  <div className="bg-red-500" style={{ width: `${polarization.hardPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
                  <span>Facile Z1-2 : {polarization.easyPct}%</span>
                  <span>Modéré Z3 : {polarization.moderatePct}%</span>
                  <span>Dur Z4-5 : {polarization.hardPct}%</span>
                </div>
              </div>
            )}
          </section>

          <section className="mb-6">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
              <Dumbbell size={14} className="text-orange-400" /> Profil musculaire
            </h2>
            {prRate && prRate.sampleSize >= 2 && (
              <div className="glass mb-2 flex items-center justify-between rounded-2xl p-4">
                <div>
                  <p className="text-xs text-zinc-500">Taux de PR (records / séries)</p>
                  <p className="mt-1 text-xl font-bold text-orange-400">{prRate.score}</p>
                </div>
                <TrendBadge trendPct={prRate.trendPct} />
              </div>
            )}
            {muscleVolume.length > 0 && (
              <div className="glass mb-2 rounded-2xl p-4">
                <p className="mb-2 text-xs text-zinc-500">Volume par groupe musculaire (7j)</p>
                <ul className="space-y-1.5">
                  {muscleVolume.map((m) => (
                    <li key={m.muscleGroup} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{m.muscleGroup}</span>
                      <span className="text-zinc-500">
                        {m.totalSets} séries · <span className="font-mono text-zinc-400">{Math.round(m.totalVolume)} kg</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {muscleFreshness.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <p className="mb-2 text-xs text-zinc-500">Fraîcheur par groupe musculaire</p>
                <div className="flex flex-wrap gap-1.5">
                  {muscleFreshness.map((f) => (
                    <span
                      key={f.muscleGroup}
                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                        f.daysSinceLast == null
                          ? 'bg-zinc-900 text-zinc-600'
                          : f.daysSinceLast <= 1
                            ? 'bg-red-500/15 text-red-400'
                            : f.daysSinceLast <= 3
                              ? 'bg-orange-500/15 text-orange-400'
                              : 'bg-teal-500/15 text-teal-400'
                      }`}
                    >
                      {f.muscleGroup} · {f.daysSinceLast == null ? 'jamais' : `${f.daysSinceLast}j`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="mb-6">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
              <Flame size={14} className="text-orange-400" /> Index spécifiques — Musculation
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
