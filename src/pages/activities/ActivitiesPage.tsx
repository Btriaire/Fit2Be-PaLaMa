import { useEffect, useMemo, useState } from 'react'
import { Footprints, Plus, X } from 'lucide-react'
import { getDb, newId } from '../../lib/db'
import { MET_ACTIVITIES, CATEGORY_META, computeCalories } from '../../lib/met'
import { getSettings } from '../../lib/settings'
import { isToday, formatTime } from '../../lib/date'
import type { ActivityLog } from '../../types'

export default function ActivitiesPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [formOpen, setFormOpen] = useState(false)

  async function refresh() {
    const db = await getDb()
    const all = await db.getAllFromIndex('activities', 'byLoggedAt')
    setLogs(all.reverse())
  }

  useEffect(() => {
    refresh()
  }, [])

  const todayLogs = useMemo(() => logs.filter((l) => isToday(l.loggedAt)), [logs])
  const todayCalories = todayLogs.reduce((sum, l) => sum + l.caloriesBurned, 0)
  const lifeMetScore = Math.round(todayLogs.reduce((sum, l) => sum + l.metValue * (l.durationMin / 60), 0) * 10)

  async function addLog(entry: Omit<ActivityLog, 'id' | 'loggedAt'>) {
    const db = await getDb()
    const log: ActivityLog = { ...entry, id: newId(), loggedAt: Date.now() }
    await db.put('activities', log)
    setFormOpen(false)
    refresh()
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Footprints className="text-green-400" size={26} />
        <h1 className="text-xl font-semibold tracking-tight">Activités & Quotidien</h1>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-3.5">
          <p className="text-xs text-zinc-500">Calories aujourd'hui</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{todayCalories}</p>
        </div>
        <div className="glass rounded-2xl p-3.5">
          <p className="text-xs text-zinc-500">Life MET Score</p>
          <p className="mt-1 text-2xl font-bold">{lifeMetScore}</p>
        </div>
      </div>

      <button
        onClick={() => setFormOpen(true)}
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-500 py-3 text-sm font-semibold text-zinc-950 active:bg-green-400"
      >
        <Plus size={16} /> Ajouter une activité
      </button>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Journal</h2>
        {logs.length === 0 && <p className="text-sm text-zinc-500">Rien pour l'instant.</p>}
        <ul className="space-y-2">
          {logs.map((l) => {
            const meta = CATEGORY_META[l.category]
            return (
              <li key={l.id} className="glass flex items-center justify-between rounded-xl p-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none">{meta.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className="text-xs text-zinc-500">
                      {l.durationMin} min · {formatTime(l.loggedAt)}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-green-400">{l.caloriesBurned} kcal</p>
              </li>
            )
          })}
        </ul>
      </section>

      {formOpen && <ActivityForm onSubmit={addLog} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function ActivityForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (entry: Omit<ActivityLog, 'id' | 'loggedAt'>) => void
  onClose: () => void
}) {
  const [activityId, setActivityId] = useState(MET_ACTIVITIES[0].id)
  const [duration, setDuration] = useState('30')
  const settings = getSettings()

  const activity = MET_ACTIVITIES.find((a) => a.id === activityId)!

  function submit() {
    const dur = parseInt(duration, 10)
    if (!dur) return
    onSubmit({
      category: activity.category,
      label: activity.label,
      metValue: activity.met,
      durationMin: dur,
      caloriesBurned: computeCalories(activity.met, settings.bodyWeightKg, dur),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Nouvelle activité</h2>
          <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {MET_ACTIVITIES.map((a) => (
            <button
              key={a.id}
              onClick={() => setActivityId(a.id)}
              className={`rounded-lg px-2.5 py-2 text-left text-xs ${
                a.id === activityId ? 'bg-green-500 text-zinc-950 font-semibold' : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              {CATEGORY_META[a.category].emoji} {a.label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-zinc-500">Durée (minutes)</label>
        <input
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="mb-4 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-green-500"
        />

        <p className="mb-4 text-center text-sm text-zinc-500">
          ≈ {computeCalories(activity.met, settings.bodyWeightKg, parseInt(duration || '0', 10))} kcal
        </p>

        <button
          onClick={submit}
          className="w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-zinc-950 active:bg-green-400"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
