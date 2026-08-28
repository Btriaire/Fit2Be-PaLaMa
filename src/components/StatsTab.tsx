import { useEffect, useMemo, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getDb } from '../lib/db'
import {
  getAllWorkouts,
  estimateWorkoutCalories,
  computeEffortDistribution,
  computeCardiacLoadUnderEffort,
  type EffortDistribution,
  type CardiacLoadUnderEffort,
} from '../lib/workouts'
import { getSettings } from '../lib/settings'
import { computeBodyComposition } from '../lib/met'
import { formatDate } from '../lib/date'
import { computeVo2Max, computePolarization, type Vo2MaxEstimate, type Polarization } from '../lib/progression'
import { computeMaxHr } from '../lib/heartRate'
import { resolveRestingHr } from '../lib/restingHr'
import { pullCardiacRangeFromNutriTracker, type RemoteCardiacDay } from '../lib/nutriTrackerSync'
import type { ActivityLog, EnduranceSession, NutritionEntry, RecoveryCheckin, WeightLog, Workout } from '../types'

function bpCategory(systolic: number, diastolic: number): { label: string; color: string } {
  // Repères informatifs (classification AHA), pas un diagnostic — jamais présenté comme tel dans l'UI.
  if (systolic >= 140 || diastolic >= 90) return { label: 'élevée', color: '#e2361c' }
  if (systolic >= 130 || diastolic >= 80) return { label: 'légèrement élevée', color: '#facc15' }
  if (systolic < 90 || diastolic < 60) return { label: 'basse', color: '#38bdf8' }
  return { label: 'normale', color: '#2dd4bf' }
}

type Period = 'day' | 'week' | 'month'

const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 }
const PERIOD_LABEL: Record<Period, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' }

const CHART_COLORS = { orange: '#e2361c', turquoise: '#2f4bd6', indigo: '#5b3fc4' }

function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfRange(days: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d.getTime()
}

/** Contenu de l'onglet Statistiques de la page Progression — anciennement
 * sa propre page (/stats), fusionné pour n'avoir qu'un seul endroit pour la
 * mesure de la progression. */
export default function StatsTab() {
  const [period, setPeriod] = useState<Period>('week')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [endurance, setEndurance] = useState<EnduranceSession[]>([])
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([])
  const [recovery, setRecovery] = useState<RecoveryCheckin[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [cardiac, setCardiac] = useState<RemoteCardiacDay[]>([])
  const [vo2max, setVo2max] = useState<Vo2MaxEstimate | null>(null)
  const [polarization, setPolarization] = useState<Polarization | null>(null)
  const [effort, setEffort] = useState<EffortDistribution | null>(null)
  const [cardiacLoad, setCardiacLoad] = useState<CardiacLoadUnderEffort | null>(null)
  const settings = getSettings()

  useEffect(() => {
    getAllWorkouts().then(setWorkouts)
    getDb().then(async (db) => {
      setActivities(await db.getAll('activities'))
      setEndurance(await db.getAll('endurance'))
      setNutrition(await db.getAll('nutrition'))
      setRecovery(await db.getAll('recovery'))
      setWeightLogs(await db.getAll('weightLogs'))
    })
    pullCardiacRangeFromNutriTracker(30).then(setCardiac)
    resolveRestingHr(settings).then((r) => computeVo2Max(settings.ageYears, r.bpm)).then(setVo2max)
    computePolarization(28).then(setPolarization)
    computeEffortDistribution(14).then(setEffort)
    computeCardiacLoadUnderEffort(14).then(setCardiacLoad)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rangeStart = startOfRange(PERIOD_DAYS[period])

  const days = useMemo(() => {
    const n = PERIOD_DAYS[period]
    const arr: { key: string; label: string; ts: number }[] = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      arr.push({ key: dayKey(d.getTime()), label: formatDate(d.getTime()), ts: d.getTime() })
    }
    return arr
  }, [period])

  const burnedByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of workouts.filter((w) => w.finishedAt && w.startedAt >= rangeStart)) {
      const k = dayKey(w.startedAt)
      map.set(k, (map.get(k) ?? 0) + estimateWorkoutCalories(w, settings))
    }
    for (const a of activities.filter((a) => a.loggedAt >= rangeStart)) {
      const k = dayKey(a.loggedAt)
      map.set(k, (map.get(k) ?? 0) + a.caloriesBurned)
    }
    for (const e of endurance.filter((e) => e.startedAt >= rangeStart)) {
      const k = dayKey(e.startedAt)
      map.set(k, (map.get(k) ?? 0) + e.caloriesBurned)
    }
    return map
  }, [workouts, activities, endurance, rangeStart, settings])

  const consumedByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of nutrition.filter((n) => n.loggedAt >= rangeStart)) {
      const k = dayKey(n.loggedAt)
      map.set(k, (map.get(k) ?? 0) + n.calories)
    }
    return map
  }, [nutrition, rangeStart])

  const caloriesChartData = days.map((d) => ({
    label: d.label,
    brûlées: Math.round(burnedByDay.get(d.key) ?? 0),
    consommées: Math.round(consumedByDay.get(d.key) ?? 0),
  }))

  const totalBurned = Array.from(burnedByDay.values()).reduce((a, b) => a + b, 0)
  const totalConsumed = Array.from(consumedByDay.values()).reduce((a, b) => a + b, 0)
  const totalWorkouts = workouts.filter((w) => w.finishedAt && w.startedAt >= rangeStart).length
  const totalSets = workouts
    .filter((w) => w.finishedAt && w.startedAt >= rangeStart)
    .reduce((s, w) => s + w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.isWarmup).length, 0), 0)
  const totalDistance = endurance.filter((e) => e.startedAt >= rangeStart).reduce((s, e) => s + (e.distanceKm ?? 0), 0)
  const avgBodyBattery = (() => {
    const inRange = recovery.filter((r) => new Date(r.date).getTime() >= rangeStart)
    if (inRange.length === 0) return null
    return Math.round(inRange.reduce((s, r) => s + r.bodyBatteryScore, 0) / inRange.length)
  })()

  const weightChartData = weightLogs
    .filter((w) => w.loggedAt >= rangeStart)
    .sort((a, b) => a.loggedAt - b.loggedAt)
    .map((w) => ({ label: formatDate(w.loggedAt), poids: w.weightKg }))

  const activityMix = useMemo(() => {
    const cats: Record<string, number> = { Gym: 0, Activités: 0, Endurance: 0 }
    cats.Gym = workouts.filter((w) => w.finishedAt && w.startedAt >= rangeStart).reduce((s, w) => s + estimateWorkoutCalories(w, settings), 0)
    cats.Activités = activities.filter((a) => a.loggedAt >= rangeStart).reduce((s, a) => s + a.caloriesBurned, 0)
    cats.Endurance = endurance.filter((e) => e.startedAt >= rangeStart).reduce((s, e) => s + e.caloriesBurned, 0)
    return Object.entries(cats)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
  }, [workouts, activities, endurance, rangeStart, settings])

  const pieColors = [CHART_COLORS.orange, CHART_COLORS.turquoise, CHART_COLORS.indigo]
  const latestCardiac = cardiac[0] ?? null
  const maxHr = computeMaxHr(settings.ageYears)
  const latestHrPctMax = latestCardiac?.heartRateAvg != null ? Math.round((latestCardiac.heartRateAvg / maxHr) * 100) : null
  const bodyComp = computeBodyComposition(settings)

  return (
    <div>
      <section className="glass mb-5 rounded-2xl p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-400">
          <HeartPulse size={13} /> Santé cardiaque & effort
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-zinc-900/70 p-3">
            <p className="text-[10px] text-zinc-500">FC repos {latestCardiac?.heartRateResting != null ? '' : '/ moyenne'}</p>
            <p className="mt-0.5 text-xl font-bold text-red-400">
              {latestCardiac?.heartRateResting ?? latestCardiac?.heartRateAvg ?? '—'}
              <span className="ml-1 text-[10px] font-normal text-zinc-600">bpm</span>
            </p>
            {latestHrPctMax != null && <p className="mt-0.5 text-[10px] text-zinc-600">{latestHrPctMax}% de la FC max ({maxHr})</p>}
          </div>
          <div className="rounded-xl bg-zinc-900/70 p-3">
            <p className="text-[10px] text-zinc-500">Tension artérielle</p>
            {latestCardiac?.systolicBP != null && latestCardiac?.diastolicBP != null ? (
              <>
                <p className="mt-0.5 text-xl font-bold" style={{ color: bpCategory(latestCardiac.systolicBP, latestCardiac.diastolicBP).color }}>
                  {latestCardiac.systolicBP}/{latestCardiac.diastolicBP}
                  <span className="ml-1 text-[10px] font-normal text-zinc-600">mmHg</span>
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-600">{bpCategory(latestCardiac.systolicBP, latestCardiac.diastolicBP).label}</p>
              </>
            ) : (
              <p className="mt-0.5 text-xl font-bold text-zinc-600">—</p>
            )}
          </div>
          <div className="rounded-xl bg-zinc-900/70 p-3">
            <p className="text-[10px] text-zinc-500">VO2max estimé</p>
            <p className="mt-0.5 text-xl font-bold text-teal-400">
              {vo2max?.vo2max ?? '—'}
              {vo2max && <span className="ml-1 text-[10px] font-normal text-zinc-600">ml/kg/min</span>}
            </p>
            {vo2max && <p className="mt-0.5 text-[10px] text-zinc-600">Formule Uth et al. · {vo2max.source}</p>}
          </div>
          <div className="rounded-xl bg-zinc-900/70 p-3">
            <p className="text-[10px] text-zinc-500">RPE moyen (14j)</p>
            <p className="mt-0.5 text-xl font-bold text-orange-400">{effort?.avgRpe ?? '—'}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{effort?.ratedSets ?? 0} série(s) notée(s)</p>
          </div>
          <div className="rounded-xl bg-zinc-900/70 p-3">
            <p className="text-[10px] text-zinc-500">Charge cardiaque à l'effort (14j)</p>
            <p className="mt-0.5 text-xl font-bold text-red-400">
              {cardiacLoad?.avgBpm ?? '—'}
              {cardiacLoad?.avgBpm != null && <span className="ml-1 text-[10px] font-normal text-zinc-600">bpm moy.</span>}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {cardiacLoad?.measuredSets ? `${cardiacLoad.measuredSets} série(s) mesurée(s)${cardiacLoad.peakBpm ? ` · pic ${cardiacLoad.peakBpm}` : ''}` : 'Mesure la FC en mode Focus'}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-900/70 p-3">
            <p className="text-[10px] text-zinc-500">IMC</p>
            <p className="mt-0.5 text-xl font-bold text-indigo-300">
              {bodyComp.bmi}
              <span className="ml-1 text-[10px] font-normal text-zinc-600">kg/m²</span>
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600 capitalize">
              {bodyComp.category} · {bodyComp.bodyFatPct}% MG estimée
            </p>
          </div>
          <div className="rounded-xl bg-zinc-900/70 p-3">
            <p className="text-[10px] text-zinc-500">Surface corporelle</p>
            <p className="mt-0.5 text-xl font-bold text-indigo-300">
              {bodyComp.bsaM2}
              <span className="ml-1 text-[10px] font-normal text-zinc-600">m²</span>
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">Formule de Mosteller</p>
          </div>
        </div>

        {polarization && (
          <div className="mb-3">
            <p className="mb-1 text-[10px] text-zinc-500">Polarisation cardio (28j) — {polarization.totalMinutes}min</p>
            <div className="flex h-2 overflow-hidden rounded-full bg-zinc-900">
              <div className="h-full bg-teal-500" style={{ width: `${polarization.easyPct}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${polarization.moderatePct}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${polarization.hardPct}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              Facile {polarization.easyPct}% · Modéré {polarization.moderatePct}% · Dur {polarization.hardPct}% — cible ≈80/20 (peu de zone 3)
            </p>
          </div>
        )}

        {effort && effort.ratedSets > 0 && (
          <div>
            <p className="mb-1 text-[10px] text-zinc-500">Répartition des niveaux de difficulté (mode Focus)</p>
            <div className="flex h-2 overflow-hidden rounded-full bg-zinc-900">
              {effort.buckets.map((b, i) => (
                <div
                  key={b.label}
                  className="h-full"
                  style={{ width: `${b.pct}%`, backgroundColor: ['#2dd4bf', '#2dd4bf', '#f59e0b', '#f97316', '#e2361c'][i] }}
                />
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-600">
              {effort.buckets
                .filter((b) => b.count > 0)
                .map((b) => (
                  <span key={b.label}>
                    {b.label} {b.pct}%
                  </span>
                ))}
            </div>
          </div>
        )}
      </section>

      <div className="mb-5 flex gap-1.5 rounded-xl bg-zinc-900 p-1">
        {(['day', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              period === p ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <StatTile label="Brûlées" value={`${Math.round(totalBurned)} kcal`} color="text-orange-400" />
        <StatTile label="Consommées" value={`${Math.round(totalConsumed)} kcal`} color="text-teal-400" />
        <StatTile label="Séances / séries" value={`${totalWorkouts} / ${totalSets}`} color="text-indigo-400" />
        <StatTile label="Distance" value={`${totalDistance.toFixed(1)} km`} color="text-teal-400" />
      </div>

      {avgBodyBattery !== null && (
        <div className="glass mb-5 rounded-2xl p-4">
          <p className="text-xs text-zinc-500">Body Battery moyen</p>
          <p className="mt-1 text-2xl font-bold text-indigo-300">{avgBodyBattery}</p>
        </div>
      )}

      <div className="glass mb-5 rounded-2xl p-3">
        <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Calories brûlées vs consommées</p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={caloriesChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === 'month' ? 4 : 0} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} />
              <Bar dataKey="brûlées" fill={CHART_COLORS.orange} radius={[3, 3, 0, 0]} />
              <Bar dataKey="consommées" fill={CHART_COLORS.turquoise} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {weightChartData.length >= 2 && (
        <div className="glass mb-5 rounded-2xl p-3">
          <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Poids</p>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#a1a1aa' }} />
                <Line type="monotone" dataKey="poids" stroke={CHART_COLORS.turquoise} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.turquoise }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activityMix.length > 0 && (
        <div className="glass mb-5 rounded-2xl p-3">
          <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Répartition des calories brûlées</p>
          <div className="flex items-center gap-4">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={activityMix} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} paddingAngle={2}>
                    {activityMix.map((entry, i) => (
                      <Cell key={entry.name} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-xs">
              {activityMix.map((entry, i) => (
                <li key={entry.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                  <span className="text-zinc-300">{entry.name}</span>
                  <span className="text-zinc-500">{entry.value} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
