import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, ChevronLeft } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDb } from '../lib/db'
import { getAllWorkouts, estimateWorkoutCalories } from '../lib/workouts'
import { getSettings } from '../lib/settings'
import { formatDate } from '../lib/date'
import type { ActivityLog, EnduranceSession, NutritionEntry, RecoveryCheckin, WeightLog, Workout } from '../types'

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

export default function StatsPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('week')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [endurance, setEndurance] = useState<EnduranceSession[]>([])
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([])
  const [recovery, setRecovery] = useState<RecoveryCheckin[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
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
  const totalDistance = endurance
    .filter((e) => e.startedAt >= rangeStart)
    .reduce((s, e) => s + (e.distanceKm ?? 0), 0)
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

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <BarChart3 className="text-zinc-300" size={20} />
        <h1 className="text-lg font-semibold tracking-tight">Statistiques</h1>
      </header>

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
