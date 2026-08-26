import { useEffect, useMemo, useState } from 'react'
import { Activity, HeartPulse, Plus, Route, Timer, X } from 'lucide-react'
import {
  ENDURANCE_ACTIVITY_META,
  computePaceMinPerKm,
  formatPace,
  getEnduranceSessions,
  logEnduranceSession,
} from '../../lib/endurance'
import { getSettings } from '../../lib/settings'
import { HR_ZONE_META } from '../../lib/heartRate'
import { formatDate, formatTime, isToday } from '../../lib/date'
import type { EnduranceActivityType, EnduranceSession } from '../../types'

function startOfWeek(): number {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // lundi = 0
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

export default function EndurancePage() {
  const [sessions, setSessions] = useState<EnduranceSession[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const settings = getSettings()

  async function refresh() {
    setSessions(await getEnduranceSessions())
  }

  useEffect(() => {
    refresh()
  }, [])

  const weekStart = startOfWeek()
  const weekSessions = useMemo(() => sessions.filter((s) => s.startedAt >= weekStart), [sessions, weekStart])
  const weekDistance = weekSessions.reduce((s, e) => s + (e.distanceKm ?? 0), 0)
  const weekZone2Min = weekSessions.filter((s) => s.hrZone === 2).reduce((s, e) => s + e.durationMin, 0)
  const todayCalories = sessions.filter((s) => isToday(s.startedAt)).reduce((s, e) => s + e.caloriesBurned, 0)

  async function addSession(input: {
    activityType: EnduranceActivityType
    durationMin: number
    distanceKm?: number
    avgHeartRate?: number
  }) {
    await logEnduranceSession(input, settings)
    setFormOpen(false)
    refresh()
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Activity className="text-teal-400" size={26} />
        <h1 className="text-xl font-semibold tracking-tight">Endurance</h1>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-3.5">
          <p className="text-xs text-zinc-500">Distance (semaine)</p>
          <p className="mt-1 text-2xl font-bold text-teal-400">{weekDistance.toFixed(1)} km</p>
        </div>
        <div className="glass rounded-2xl p-3.5">
          <p className="text-xs text-zinc-500">Zone 2 (semaine)</p>
          <p className="mt-1 text-2xl font-bold text-teal-400">{weekZone2Min} min</p>
        </div>
      </div>

      {todayCalories > 0 && (
        <p className="mb-4 px-1 text-xs text-zinc-500">
          <span className="text-orange-400">{todayCalories} kcal</span> brûlées en endurance aujourd'hui
        </p>
      )}

      <button
        onClick={() => setFormOpen(true)}
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
      >
        <Plus size={16} /> Enregistrer une sortie
      </button>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Historique</h2>
        {sessions.length === 0 && <p className="text-sm text-zinc-500">Rien pour l'instant.</p>}
        <ul className="space-y-2">
          {sessions.map((s) => {
            const meta = ENDURANCE_ACTIVITY_META[s.activityType]
            const pace = s.distanceKm ? computePaceMinPerKm(s.durationMin, s.distanceKm) : null
            const zoneMeta = s.hrZone ? HR_ZONE_META[s.hrZone] : null
            return (
              <li key={s.id} className="glass rounded-xl p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(s.startedAt)} · {formatTime(s.startedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Timer size={12} /> {s.durationMin} min
                  </span>
                  {s.distanceKm && (
                    <span className="flex items-center gap-1">
                      <Route size={12} /> {s.distanceKm} km
                    </span>
                  )}
                  {pace && <span>{formatPace(pace)}</span>}
                  {s.avgHeartRate && (
                    <span className="flex items-center gap-1">
                      <HeartPulse size={12} /> {s.avgHeartRate} bpm
                    </span>
                  )}
                  {zoneMeta && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${zoneMeta.color}22`, color: zoneMeta.color }}>
                      Z{s.hrZone} · {zoneMeta.label}
                    </span>
                  )}
                  <span className="ml-auto font-semibold text-orange-400">{s.caloriesBurned} kcal</span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {formOpen && <EnduranceForm onSubmit={addSession} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function EnduranceForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (input: { activityType: EnduranceActivityType; durationMin: number; distanceKm?: number; avgHeartRate?: number }) => void
  onClose: () => void
}) {
  const [activityType, setActivityType] = useState<EnduranceActivityType>('course')
  const [duration, setDuration] = useState('30')
  const [distance, setDistance] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const meta = ENDURANCE_ACTIVITY_META[activityType]

  function submit() {
    const dur = parseInt(duration, 10)
    if (!dur) return
    onSubmit({
      activityType,
      durationMin: dur,
      distanceKm: distance ? parseFloat(distance) : undefined,
      avgHeartRate: avgHr ? parseInt(avgHr, 10) : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Nouvelle sortie</h2>
          <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1.5">
          {(Object.keys(ENDURANCE_ACTIVITY_META) as EnduranceActivityType[]).map((key) => (
            <button
              key={key}
              onClick={() => setActivityType(key)}
              className={`rounded-lg px-2.5 py-2.5 text-left text-xs font-medium ${
                key === activityType ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              {ENDURANCE_ACTIVITY_META[key].label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-zinc-500">Durée (minutes)</label>
        <input
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
        />

        {meta.hasDistance && (
          <>
            <label className="mb-1 block text-xs text-zinc-500">Distance (km, optionnel)</label>
            <input
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="ex: 8.5"
              className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
            />
          </>
        )}

        <label className="mb-1 block text-xs text-zinc-500">FC moyenne (bpm, optionnel)</label>
        <input
          inputMode="numeric"
          value={avgHr}
          onChange={(e) => setAvgHr(e.target.value)}
          placeholder="ex: 145"
          className="mb-4 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
        />

        <button
          onClick={submit}
          className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
