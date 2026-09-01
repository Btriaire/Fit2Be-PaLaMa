import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Flame, HeartPulse, Route, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getEnduranceHistory, ENDURANCE_ACTIVITY_META, formatPace, type EnduranceHistoryPoint } from '../../lib/endurance'
import { formatDate } from '../../lib/date'
import type { EnduranceActivityType } from '../../types'

const TOOLTIP_STYLE = { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }
const TOOLTIP_LABEL_STYLE = { color: '#a1a1aa' }

export default function EnduranceHistory() {
  const { activityType } = useParams<{ activityType: string }>()
  const navigate = useNavigate()
  const [points, setPoints] = useState<EnduranceHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activityType) return
    getEnduranceHistory(activityType as EnduranceActivityType).then((p) => {
      setPoints(p)
      setLoading(false)
    })
  }, [activityType])

  const meta = activityType ? ENDURANCE_ACTIVITY_META[activityType as EnduranceActivityType] : null
  const hasDistanceData = points.some((p) => p.distanceKm)
  const hasHrData = points.some((p) => p.avgHeartRate)

  const paceData = points
    .filter((p) => p.paceMinPerKm !== null)
    .map((p) => ({ label: formatDate(p.date), allure: p.paceMinPerKm }))
  const bestPace = paceData.length ? Math.min(...paceData.map((c) => c.allure as number)) : null
  const totalDistance = points.reduce((s, p) => s + (p.distanceKm ?? 0), 0)

  const volumeData = points.map((p) => ({ label: formatDate(p.date), distance: p.distanceKm ?? 0, duree: p.durationMin }))

  const cumulativeData = useMemo(() => {
    let running = 0
    return points.map((p) => {
      running += p.distanceKm ?? 0
      return { label: formatDate(p.date), cumul: Math.round(running * 10) / 10 }
    })
  }, [points])

  // Sur tapis, la distance cumulée mélange des sorties à vitesses très
  // différentes et n'indique rien d'utile sur le volume d'entraînement — les
  // calories cumulées sont un meilleur indicateur de charge, indépendant de
  // l'allure choisie ce jour-là.
  const cumulativeCaloriesData = useMemo(() => {
    let running = 0
    return points.map((p) => {
      running += p.caloriesBurned
      return { label: formatDate(p.date), cumul: running }
    })
  }, [points])

  const hrData = points.filter((p) => p.avgHeartRate).map((p) => ({ label: formatDate(p.date), fc: p.avgHeartRate }))
  const caloriesData = points.map((p) => ({ label: formatDate(p.date), kcal: p.caloriesBurned }))

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-lg font-semibold tracking-tight">{meta?.label ?? activityType}</h1>
      </header>

      {loading && <p className="px-1 text-sm text-zinc-500">Chargement…</p>}
      {!loading && points.length === 0 && <p className="px-1 text-sm text-zinc-500">Pas encore de données.</p>}

      {!loading && points.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {hasDistanceData && (
              <div className="glass flex items-center gap-2 rounded-2xl p-4">
                <Route className="text-teal-400" size={20} />
                <div>
                  <p className="text-xs text-zinc-500">Distance totale</p>
                  <p className="text-lg font-bold text-teal-400">{totalDistance.toFixed(1)} km</p>
                </div>
              </div>
            )}
            {bestPace !== null && (
              <div className="glass flex items-center gap-2 rounded-2xl p-4">
                <TrendingUp className="text-teal-400" size={20} />
                <div>
                  <p className="text-xs text-zinc-500">Meilleure allure</p>
                  <p className="text-lg font-bold text-teal-400">{formatPace(bestPace)}</p>
                </div>
              </div>
            )}
          </div>

          {paceData.length >= 2 && (
            <div className="glass mb-4 rounded-2xl p-3">
              <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Allure (min/km) par sortie</p>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paceData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      reversed
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      domain={['dataMin - 0.3', 'dataMax + 0.3']}
                      tickFormatter={(v) => formatPace(v)}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => [formatPace(Number(v)), 'Allure']} />
                    <Line type="monotone" dataKey="allure" stroke="#2f4bd6" strokeWidth={2} dot={{ r: 3, fill: '#2f4bd6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activityType === 'tapis' && cumulativeCaloriesData.length >= 2 && (
            <div className="glass mb-4 rounded-2xl p-3">
              <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Calories cumulées</p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeCaloriesData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumulCalFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e2361c" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#e2361c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => [`${v} kcal`, 'Cumul']} />
                    <Area type="monotone" dataKey="cumul" stroke="#e2361c" strokeWidth={2} fill="url(#cumulCalFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activityType !== 'tapis' && hasDistanceData && cumulativeData.length >= 2 && (
            <div className="glass mb-4 rounded-2xl p-3">
              <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Distance cumulée</p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumulFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => [`${v} km`, 'Cumul']} />
                    <Area type="monotone" dataKey="cumul" stroke="#2dd4bf" strokeWidth={2} fill="url(#cumulFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {volumeData.length >= 2 && (
            <div className="glass mb-4 rounded-2xl p-3">
              <p className="mb-2 px-1 text-xs font-medium text-zinc-400">
                {hasDistanceData ? 'Distance par sortie (km)' : 'Durée par sortie (min)'}
              </p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                    <Bar dataKey={hasDistanceData ? 'distance' : 'duree'} fill="#5b3fc4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {hasHrData && hrData.length >= 2 && (
            <div className="glass mb-4 rounded-2xl p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-zinc-400">
                <HeartPulse size={12} className="text-red-400" /> FC moyenne par sortie
              </p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hrData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => [`${v} bpm`, 'FC moy.']} />
                    <Line type="monotone" dataKey="fc" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {caloriesData.length >= 2 && (
            <div className="glass mb-4 rounded-2xl p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-zinc-400">
                <Flame size={12} className="text-orange-400" /> Calories par sortie
              </p>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={caloriesData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => [`${v} kcal`, 'Calories']} />
                    <Bar dataKey="kcal" fill="#e2361c" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {[...points].reverse().map((p, i) => (
              <div key={i} className="glass flex items-center justify-between rounded-xl p-3">
                <p className="text-sm text-zinc-400">{formatDate(p.date)}</p>
                <p className="font-mono text-sm font-semibold">
                  {p.distanceKm ? `${p.distanceKm}km · ` : ''}
                  {p.durationMin}min
                  {p.paceMinPerKm && <span className="text-zinc-600"> · {formatPace(p.paceMinPerKm)}</span>}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
