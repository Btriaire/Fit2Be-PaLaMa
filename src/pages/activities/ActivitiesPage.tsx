import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, Footprints, Plus, Route, Trash2, Watch, X } from 'lucide-react'
import { getDb, newId } from '../../lib/db'
import { MET_ACTIVITIES, computeCaloriesForUser } from '../../lib/met'
import { getSettings } from '../../lib/settings'
import { isToday, formatTime, formatDate, dayKey, todayStr, addDays } from '../../lib/date'
import { pushActivityToNutriTracker } from '../../lib/nutriTrackerSync'
import { pushRecord, deleteRecord } from '../../lib/cloudSync'
import { ACTIVITY_PHOTOS } from '../../lib/activityPhotos'
import { ENDURANCE_ACTIVITY_META, getEnduranceSessions, logEnduranceSession } from '../../lib/endurance'
import { isSynthetic } from '../../lib/enduranceMerge'
import { getGoogleFitDays } from '../../lib/googleFit'
import { onFitRefreshed, refreshFitData } from '../../lib/fitSync'
import ActivityHero from '../../components/ActivityHero'
import BackButton from '../../components/BackButton'
import type { ActivityCategory, ActivityLog, EnduranceActivityType, EnduranceSession } from '../../types'

/** Activités du formulaire qui sont en fait de l'endurance : elles sont enregistrées comme
 * une sortie Endurance (un seul endroit, avec distance/FC/progression, fusion avec la
 * montre) plutôt qu'en activité générique — c'était la source des marches "en double". */
const MET_TO_ENDURANCE: Record<string, EnduranceActivityType> = {
  'running-10kmh': 'course',
  'running-8kmh': 'course',
  'cycling-moderate': 'velo',
  swimming: 'natation',
  hiking: 'marche',
  'walking-brisk': 'marche',
}

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
  const [sessions, setSessions] = useState<EnduranceSession[]>([])
  const [autoWalks, setAutoWalks] = useState<Record<string, EnduranceSession>>({})
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({})
  const [formOpen, setFormOpen] = useState(navState.openForm ?? false)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    const db = await getDb()
    const all = await db.getAllFromIndex('activities', 'byLoggedAt')
    setLogs(all.reverse())
    const endurance = await getEnduranceSessions()
    // Journée complète : activités + sorties (marche, course, vélo… importées ou saisies).
    // La marche auto "pas du jour" n'est pas une ligne (elle se répétait identique chaque
    // jour) : elle est résumée dans l'en-tête du jour, avec le nombre de pas.
    setSessions(endurance.filter((s) => !isSynthetic(s)))
    setAutoWalks(Object.fromEntries(endurance.filter(isSynthetic).map((s) => [s.id.slice('steps-'.length), s])))
    const days = await getGoogleFitDays(60)
    setStepsByDay(Object.fromEntries(days.map((d) => [d.date, d.steps])))
  }

  useEffect(() => {
    refresh()
    return onFitRefreshed(() => void refresh())
  }, [])

  const todayLogs = useMemo(() => logs.filter((l) => isToday(l.loggedAt)), [logs])
  const todaySessions = useMemo(() => sessions.filter((s) => isToday(s.startedAt)), [sessions])
  // Même total que "kcal brûlées" de l'Accueil : activités + sorties + pas du quotidien.
  const todayCalories =
    todayLogs.reduce((sum, l) => sum + l.caloriesBurned, 0) +
    todaySessions.reduce((sum, s) => sum + s.caloriesBurned, 0) +
    (autoWalks[todayStr()]?.caloriesBurned ?? 0)
  const lifeMetScore = Math.round(todayLogs.reduce((sum, l) => sum + l.metValue * (l.durationMin / 60), 0) * 10)

  // Un seul fil chronologique au lieu de deux blocs disjoints (Journal, puis Marche plus
  // bas sans lien de date) : sinon une marche d'il y a 3 semaines se retrouvait collée à
  // une activité d'aujourd'hui, sans aucun repère temporel entre les deux.
  type TimelineItem =
    | { kind: 'activity'; at: number; log: ActivityLog }
    | { kind: 'session'; at: number; session: EnduranceSession }
  const timeline = useMemo<TimelineItem[]>(
    () =>
      [
        ...logs.map((log): TimelineItem => ({ kind: 'activity', at: log.loggedAt, log })),
        ...sessions.map((session): TimelineItem => ({ kind: 'session', at: session.startedAt, session })),
      ].sort((a, b) => b.at - a.at),
    [logs, sessions],
  )
  const timelineGroups = useMemo(() => {
    const groups: { dateStr: string; items: TimelineItem[] }[] = []
    for (const item of timeline) {
      const dateStr = dayKey(item.at)
      const last = groups[groups.length - 1]
      if (last && last.dateStr === dateStr) last.items.push(item)
      else groups.push({ dateStr, items: [item] })
    }
    return groups
  }, [timeline])

  function dayGroupLabel(dateStr: string): string {
    if (dateStr === todayStr()) return "Aujourd'hui"
    if (dateStr === addDays(todayStr(), -1)) return 'Hier'
    return formatDate(new Date(`${dateStr}T12:00:00`).getTime())
  }

  async function addLog(entry: Omit<ActivityLog, 'id' | 'loggedAt'>, metId: string) {
    const enduranceType = MET_TO_ENDURANCE[metId]
    if (enduranceType) {
      const saved = await logEnduranceSession(
        { activityType: enduranceType, durationMin: entry.durationMin, startedAt: Date.now() - entry.durationMin * 60_000 },
        getSettings(),
      )
      setFormOpen(false)
      setNotice(
        saved.externalId
          ? `Déjà enregistrée par ta montre : ${ENDURANCE_ACTIVITY_META[enduranceType].label.toLowerCase()} fusionnée, comptée une seule fois.`
          : `${ENDURANCE_ACTIVITY_META[enduranceType].label} ajoutée à tes sorties Endurance (distance et FC modifiables dans le détail).`,
      )
      refresh()
      // Recalcule la marche auto du jour (les pas de cette sortie ne doivent plus y compter).
      void refreshFitData(getSettings()).catch(() => {})
      return
    }
    const db = await getDb()
    const log: ActivityLog = { ...entry, id: newId(), loggedAt: Date.now(), source: 'manual' }
    await db.put('activities', log)
    pushRecord('activities', log.id, log)
    setFormOpen(false)
    refresh()
    if (log.category === 'quotidien') void refreshFitData(getSettings()).catch(() => {})

    const googleFitType = MET_ACTIVITIES.find((a) => a.label === entry.label)?.googleFitType ?? 97
    void pushActivityToNutriTracker({
      name: entry.label,
      activityType: googleFitType,
      durationMin: entry.durationMin,
      caloriesBurned: entry.caloriesBurned,
      date: dayKey(log.loggedAt),
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

      {notice && (
        <div className="-mt-3 mb-5 flex items-start gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-200" role="status">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 rounded-full p-0.5 text-teal-300 active:bg-zinc-800" aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Journal</h2>
        {timeline.length === 0 && <p className="text-sm text-zinc-500">Rien pour l'instant.</p>}
        <div className="space-y-4">
          {timelineGroups.map((group) => (
            <div key={group.dateStr}>
              <p className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <span>{dayGroupLabel(group.dateStr)}</span>
                {stepsByDay[group.dateStr] != null && (
                  <span className="flex items-center gap-1 normal-case tracking-normal text-zinc-500">
                    <Footprints size={11} className="text-teal-400" />
                    {stepsByDay[group.dateStr].toLocaleString('fr-FR')} pas
                    {autoWalks[group.dateStr] && <span className="text-zinc-600">· +{autoWalks[group.dateStr].caloriesBurned} kcal hors sorties</span>}
                  </span>
                )}
              </p>
              <ul className="space-y-2">
                {group.items.map((item) =>
                  item.kind === 'activity' ? (
                    <ActivityLogRow key={item.log.id} log={item.log} onDelete={removeLog} />
                  ) : (
                    <SessionRow key={item.session.id} session={item.session} onOpen={() => navigate(`/endurance/session/${item.session.id}`)} />
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {formOpen && (
        <ActivityForm onSubmit={addLog} onClose={() => setFormOpen(false)} filterIds={navState.filterIds} />
      )}
      </div>
    </div>
  )
}

function ActivityLogRow({ log, onDelete }: { log: ActivityLog; onDelete: (id: string) => void }) {
  const activityId = MET_ACTIVITIES.find((a) => a.label === log.label)?.id
  return (
    <li className="glass flex items-center justify-between rounded-xl p-3">
      <div className="flex items-center gap-2.5">
        {activityId && ACTIVITY_PHOTOS[activityId] ? (
          <img src={ACTIVITY_PHOTOS[activityId]} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="h-10 w-10 shrink-0 rounded-lg bg-zinc-900" />
        )}
        <div>
          <p className="text-sm font-medium">{log.label}</p>
          <p className="text-xs text-zinc-500">
            {log.durationMin} min · {formatTime(log.loggedAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-teal-400">{log.caloriesBurned} kcal</p>
        <button
          onClick={() => onDelete(log.id)}
          className="shrink-0 rounded-full p-1 text-zinc-600 active:bg-red-500/10 active:text-red-400"
          aria-label="Supprimer l'activité"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}

// Une sortie Endurance (marche, course, vélo… importée de la montre ou saisie) : même
// enregistrement que dans Endurance, on y renvoie pour le détail.
function SessionRow({ session, onOpen }: { session: EnduranceSession; onOpen: () => void }) {
  const meta = ENDURANCE_ACTIVITY_META[session.activityType]
  return (
    <li>
      <button onClick={onOpen} className="glass flex w-full items-center justify-between rounded-xl p-3 text-left active:bg-zinc-900/80">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
            {session.activityType === 'marche' ? <Route size={18} className="text-teal-400" /> : <Activity size={18} className="text-teal-400" />}
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {meta.label} {session.distanceKm ? `· ${session.distanceKm.toFixed(1)} km` : ''}
              {session.externalId && <Watch size={12} className="text-zinc-500" aria-label="Importée de la montre" />}
            </p>
            <p className="text-xs text-zinc-500">
              {formatTime(session.startedAt)} · {session.durationMin} min · Endurance
            </p>
          </div>
        </div>
        <p className="text-sm font-semibold text-teal-400">{session.caloriesBurned} kcal</p>
      </button>
    </li>
  )
}

function ActivityForm({
  onSubmit,
  onClose,
  filterIds,
}: {
  onSubmit: (entry: Omit<ActivityLog, 'id' | 'loggedAt'>, metId: string) => void
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
    }, activity.id)
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
                      <span className="min-w-0">
                        <span className={`block text-sm ${a.id === activityId ? 'font-semibold text-teal-400' : 'text-zinc-200'}`}>{a.label}</span>
                        {MET_TO_ENDURANCE[a.id] && <span className="mt-0.5 block text-[10px] text-zinc-500">→ enregistrée dans Endurance</span>}
                      </span>
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
