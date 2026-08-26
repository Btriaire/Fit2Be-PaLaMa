import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Route, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getEnduranceHistory, ENDURANCE_ACTIVITY_META, formatPace, type EnduranceHistoryPoint } from '../../lib/endurance'
import { formatDate } from '../../lib/date'
import type { EnduranceActivityType } from '../../types'

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
  const chartData = points
    .filter((p) => p.paceMinPerKm !== null)
    .map((p) => ({ label: formatDate(p.date), allure: p.paceMinPerKm }))
  const bestPace = chartData.length
    ? Math.min(...chartData.map((c) => c.allure as number))
    : null
  const totalDistance = points.reduce((s, p) => s + (p.distanceKm ?? 0), 0)

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

          {chartData.length >= 2 && (
            <div className="glass mb-4 rounded-2xl p-3">
              <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Allure (min/km) par sortie</p>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(v) => [formatPace(Number(v)), 'Allure']}
                    />
                    <Line type="monotone" dataKey="allure" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 3, fill: '#2dd4bf' }} />
                  </LineChart>
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
