import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getExerciseHistory, type ExerciseHistoryPoint } from '../../lib/workouts'
import { SEED_EXERCISES } from '../../lib/exercises'
import { formatDate } from '../../lib/date'

export default function ExerciseHistory() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()
  const [points, setPoints] = useState<ExerciseHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!exerciseId) return
    getExerciseHistory(exerciseId).then((p) => {
      setPoints(p)
      setLoading(false)
    })
  }, [exerciseId])

  const exercise = SEED_EXERCISES.find((e) => e.id === exerciseId)
  const chartData = points.map((p) => ({ ...p, label: formatDate(p.date) }))
  const best = points.reduce((max, p) => Math.max(max, p.maxWeightKg), 0)

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{exercise?.name ?? exerciseId}</h1>
          <p className="text-xs text-zinc-500">{exercise?.muscleGroup}</p>
        </div>
      </header>

      {loading && <p className="px-1 text-sm text-zinc-500">Chargement…</p>}

      {!loading && points.length === 0 && (
        <p className="px-1 text-sm text-zinc-500">Pas encore de données pour cet exercice.</p>
      )}

      {!loading && points.length > 0 && (
        <>
          <div className="glass mb-4 flex items-center gap-2 rounded-2xl p-4">
            <TrendingUp className="text-orange-400" size={20} />
            <div>
              <p className="text-xs text-zinc-500">Record actuel</p>
              <p className="text-xl font-bold text-orange-400">{best} kg</p>
            </div>
          </div>

          <div className="glass mb-4 rounded-2xl p-3">
            <p className="mb-2 px-1 text-xs font-medium text-zinc-400">Poids max par séance</p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  <Line type="monotone" dataKey="maxWeightKg" name="Poids max (kg)" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2">
            {[...points].reverse().map((p, i) => (
              <div key={i} className="glass flex items-center justify-between rounded-xl p-3">
                <p className="text-sm text-zinc-400">{formatDate(p.date)}</p>
                <p className="font-mono text-sm font-semibold">
                  {p.maxWeightKg}kg <span className="text-zinc-600">· {p.totalSets} séries</span>
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
