import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Footprints, Plus, Trash2, X } from 'lucide-react'
import { getDb, newId } from '../../lib/db'
import { MET_ACTIVITIES, computeCaloriesForUser } from '../../lib/met'
import { getSettings } from '../../lib/settings'
import { isToday, formatTime, formatDate } from '../../lib/date'
import { pushActivityToNutriTracker } from '../../lib/nutriTrackerSync'
import { pushRecord, deleteRecord } from '../../lib/cloudSync'
import { ACTIVITY_PHOTOS } from '../../lib/activityPhotos'
import { getEnduranceSessions } from '../../lib/endurance'
import ActivityHero from '../../components/ActivityHero'
import BackButton from '../../components/BackButton'
import type { ActivityCategory, ActivityLog, EnduranceSession } from '../../types'

const CATEGORY_SECTION_LABEL: Partial<Record<ActivityCategory, string>> = {
  outdoor: 'Sport',
  loisir: 'Loisirs',
  quotidien: 'Quotidien',
  bureau: 'Au bureau',
  deplacement: 'Déplacement pro',
}

interface NavState {
  openForm?: boolean
  filterIds?: string[]
}

export default function ActivitiesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const navState = (location.state as NavState) ?? {}
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [marcheSessions, setMarcheSessions] = useState<EnduranceSession[]>([])
  const [formOpen, setFormOpen] = useState(navState.openForm ?? false)

  async function refresh() {
    const db = await getDb()
    const all = await db.getAllFromIndex('activities', 'byLoggedAt')
    setLogs(all.reverse())
    const endurance = await getEnduranceSessions()
    setMarcheSessions(endurance.filter((s) => s.activityType === 'marche'))
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
    pushRecord('activities', log.id, log)
    setFormOpen(false)
    refresh()

    const googleFitType = MET_ACTIVITIES.find((a) => a.label === entry.label)?.googleFitType ?? 97
    void pushActivityToNutriTracker({
      name: entry.label,
      activityType: googleFitType,
      durationMin: entry.durationMin,
      caloriesBurned: entry.caloriesBurned,
      date: new Date(log.loggedAt).toISOString().slice(0, 10),
    })
  }

  async function removeLog(id: string) {
    if (!confirm('Supprimer cette activité ?')) return
    const db = await getDb()
    await db.delete('activities', id)
    deleteRecord('activities', id)
    refresh()
  }

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="marche" className="h-40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <BackButton />
          <Footprints className="text-teal-400" size={24} />
          <h1 className="text-xl font-semibold tracking-tight text-white drop-shadow">Activités & Quotidien</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
      <div className="mb-6 grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-3.5">
          <p className="text-xs text-zinc-500">Calories aujourd'hui</p>
          <p className="mt-1 text-2xl font-bold text-teal-400">{todayCalories}</p>
        </div>
        <div className="glass rounded-2xl p-3.5">
          <p className="text-xs text-zinc-500">Life MET Score</p>
          <p className="mt-1 text-2xl font-bold">{lifeMetScore}</p>
        </div>
      </div>

      <button
        onClick={() => setFormOpen(true)}
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
      >
        <Plus size={16} /> Ajouter une activité
      </button>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Journal</h2>
        {logs.length === 0 && <p className="text-sm text-zinc-500">Rien pour l'instant.</p>}
        <ul className="space-y-2">
          {logs.map((l) => {
            const activityId = MET_ACTIVITIES.find((a) => a.label === l.label)?.id
            return (
              <li key={l.id} className="glass flex items-center justify-between rounded-xl p-3">
                <div className="flex items-center gap-2.5">
                  {activityId && ACTIVITY_PHOTOS[activityId] ? (
                    <img src={ACTIVITY_PHOTOS[activityId]} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-lg bg-zinc-900" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className="text-xs text-zinc-500">
                      {l.durationMin} min · {formatTime(l.loggedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-teal-400">{l.caloriesBurned} kcal</p>
                  <button
                    onClick={() => removeLog(l.id)}
                    className="shrink-0 rounded-full p-1 text-zinc-600 active:bg-red-500/10 active:text-red-400"
                    aria-label="Supprimer l'activité"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {marcheSessions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">Marche (historique)</h2>
          <ul className="space-y-2">
            {marcheSessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => navigate(`/endurance/session/${s.id}`)}
                  className="glass flex w-full items-center justify-between rounded-xl p-3 text-left active:bg-zinc-900/80"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
                      <Footprints size={18} className="text-teal-400" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        Marche {s.distanceKm ? `· ${s.distanceKm.toFixed(1)} km` : ''}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(s.startedAt)} · {s.durationMin} min
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-teal-400">{s.caloriesBurned} kcal</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {formOpen && (
        <ActivityForm onSubmit={addLog} onClose={() => setFormOpen(false)} filterIds={navState.filterIds} />
      )}
      </div>
    </div>
  )
}

function ActivityForm({
  onSubmit,
  onClose,
  filterIds,
}: {
  onSubmit: (entry: Omit<ActivityLog, 'id' | 'loggedAt'>) => void
  onClose: () => void
  filterIds?: string[]
}) {
  const options = filterIds ? MET_ACTIVITIES.filter((a) => filterIds.includes(a.id)) : MET_ACTIVITIES
  const [activityId, setActivityId] = useState(options[0]?.id ?? MET_ACTIVITIES[0].id)
  const [duration, setDuration] = useState('30')
  const settings = getSettings()

  const activity = options.find((a) => a.id === activityId) ?? options[0]

  const sections = (['outdoor', 'loisir', 'bureau', 'deplacement', 'quotidien'] as ActivityCategory[])
    .map((cat) => ({ cat, items: options.filter((a) => a.category === cat) }))
    .filter((s) => s.items.length > 0)

  function submit() {
    const dur = parseInt(duration, 10)
    if (!dur) return
    onSubmit({
      category: activity.category,
      label: activity.label,
      metValue: activity.met,
      durationMin: dur,
      caloriesBurned: computeCaloriesForUser(activity.met, dur, settings),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-4 pb-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Nouvelle activité</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {sections.map(({ cat, items }) => (
            <div key={cat} className="mb-4">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">{CATEGORY_SECTION_LABEL[cat]}</h3>
              <ul className="space-y-1.5">
                {items.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setActivityId(a.id)}
                      className={`glass flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left ${
                        a.id === activityId ? 'ring-2 ring-teal-500' : ''
                      }`}
                    >
                      {ACTIVITY_PHOTOS[a.id] ? (
                        <img src={ACTIVITY_PHOTOS[a.id]} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-900" />
                      )}
                      <span className={`text-sm ${a.id === activityId ? 'font-semibold text-teal-400' : 'text-zinc-200'}`}>{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <label className="mb-1 block text-xs text-zinc-500">Durée (minutes)</label>
          <input
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
          />

          <p className="mb-3 text-center text-sm text-zinc-500">
            ≈ {computeCaloriesForUser(activity.met, parseInt(duration || '0', 10), settings)} kcal
          </p>

          <button
            onClick={submit}
            className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
