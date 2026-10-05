import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, ChevronDown, ChevronRight, Flame, Footprints, HeartPulse, Loader2, Plus, RefreshCw, Route, Trash2, TrendingUp, Timer, Watch, X } from 'lucide-react'
import { ENDURANCE_ACTIVITY_META, MET_TO_ENDURANCE, computePaceMinPerKm, formatPace, getEnduranceSessions, logEnduranceSession, deleteEnduranceSession, getLoggedActivityTypes } from '../../lib/endurance'
import { getDb, newId } from '../../lib/db'
import { pushRecord, deleteRecord } from '../../lib/cloudSync'
import { pushActivityToNutriTracker } from '../../lib/nutriTrackerSync'
import { MET_ACTIVITIES } from '../../lib/met'
import { AddActivitySheet, ActivityLogRow } from '../activities/AddActivitySheet'
import { getSettings } from '../../lib/settings'
import { HR_ZONE_META } from '../../lib/heartRate'
import { formatDate, formatTime, isToday, todayStr, addDays, dayKey } from '../../lib/date'
import { refreshFitData, lastFitRefreshAt, formatAgo, onFitRefreshed } from '../../lib/fitSync'
import { getGoogleFitDays } from '../../lib/googleFit'
import { isSynthetic } from '../../lib/enduranceMerge'
import { type ParsedMachineResult } from '../../lib/machineScan'
import { ENDURANCE_PROGRAMS, programDurationMin, type EnduranceProgram } from '../../lib/endurancePrograms'
import { getCustomEndurancePrograms, saveCustomEnduranceProgram, deleteCustomEnduranceProgram, type CustomEnduranceProgram } from '../../lib/customEndurancePrograms'
import { fitsTimeBudget, readinessMatchScore, type Readiness, type TimeBudget } from '../../lib/coachingFilter'
import { useCollapsible } from '../../lib/useCollapsible'
import CoachingQuestions from '../../components/CoachingQuestions'
import Collapsible from '../../components/Collapsible'
import CustomProgramBuilder from './CustomProgramBuilder'
import RouteMap from '../../components/RouteMap'
import ActivityHero from '../../components/ActivityHero'
import BackButton from '../../components/BackButton'
import type { ActivityLog, EnduranceActivityType, EnduranceSession, HealthScreenCapture, MachineStats, PhaseLogEntry, RoutePoint } from '../../types'
import { ProgramPreview } from './ProgramPreview'
import { EnduranceForm } from './EnduranceForm'

interface NavState {
  openForm?: boolean
  scanResult?: ParsedMachineResult
  /** Ouvre directement le choix d'activité (raccourcis de la page Ajouter, ancien lien Activités). */
  openActivity?: boolean
  filterIds?: string[]
}

type JournalItem = { kind: 'session'; at: number; session: EnduranceSession } | { kind: 'activity'; at: number; log: ActivityLog }

export default function EndurancePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state as NavState) ?? {}
  const [sessions, setSessions] = useState<EnduranceSession[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [addOpen, setAddOpen] = useState(navState.openActivity ?? false)
  const [loggedTypes, setLoggedTypes] = useState<Array<{ activityType: EnduranceActivityType; lastDate: number }>>([])
  const [formOpen, setFormOpen] = useState(navState.openForm ?? false)
  const [formType, setFormType] = useState<EnduranceActivityType | undefined>(undefined)
  const [historyDays, setHistoryDays] = useState(30)
  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({})
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<number | null>(() => lastFitRefreshAt())
  const [notice, setNotice] = useState<string | null>(null)
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null)
  const [previewProgram, setPreviewProgram] = useState<EnduranceProgram | null>(null)
  const [pendingProgram, setPendingProgram] = useState<EnduranceProgram | null>(null)
  const [coachingOpen, setCoachingOpen] = useCollapsible('endurance-coaching')
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [timeBudget, setTimeBudget] = useState<TimeBudget | null>(null)
  const [customPrograms, setCustomPrograms] = useState<CustomEnduranceProgram[]>([])
  const [builderOpen, setBuilderOpen] = useState<'new' | CustomEnduranceProgram | null>(null)
  const settings = getSettings()

  function refreshCustomPrograms() {
    getCustomEndurancePrograms().then(setCustomPrograms)
  }

  async function refresh() {
    setSessions(await getEnduranceSessions())
    setLogs(await (await getDb()).getAll('activities'))
    setLoggedTypes(await getLoggedActivityTypes())
    const days = await getGoogleFitDays(60)
    setStepsByDay(Object.fromEntries(days.map((d) => [d.date, d.steps])))
  }

  async function syncWatch(force: boolean) {
    setSyncing(true)
    try {
      const r = await refreshFitData(settings, { force })
      setLastSync(r.at)
      if (force) {
        const parts = [r.imported > 0 ? `${r.imported} séance(s) importée(s)` : 'Aucune nouvelle séance', r.merged > 0 ? `${r.merged} doublon(s) fusionné(s)` : null]
        setNotice(parts.filter(Boolean).join(' · '))
      }
    } catch {
      if (force) setNotice('Synchro impossible pour le moment — réessaie plus tard.')
    } finally {
      setSyncing(false)
      refresh()
    }
  }

  useEffect(() => {
    refresh()
    refreshCustomPrograms()
    // En arrivant sur la page, récupère les séances de la montre si la dernière synchro date.
    const last = lastFitRefreshAt()
    if (!last || Date.now() - last > 10 * 60_000) void syncWatch(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () =>
      onFitRefreshed(() => {
        setLastSync(lastFitRefreshAt())
        void refresh()
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const visibleCoachingPrograms = useMemo(
    () =>
      ([...ENDURANCE_PROGRAMS, ...customPrograms] as EnduranceProgram[])
        .filter((p) => timeBudget == null || fitsTimeBudget(programDurationMin(p), timeBudget))
        .sort((a, b) => (readiness ? readinessMatchScore(a.difficulty, readiness) - readinessMatchScore(b.difficulty, readiness) : 0)),
    [readiness, timeBudget, customPrograms],
  )

  // Un groupe par type d'activité (vélo, tapis...), chacun replié par défaut.
  const programGroups = useMemo(() => {
    const byType = new Map<EnduranceActivityType, EnduranceProgram[]>()
    for (const p of visibleCoachingPrograms) {
      const list = byType.get(p.activityType)
      if (list) list.push(p)
      else byType.set(p.activityType, [p])
    }
    return [...byType.entries()]
  }, [visibleCoachingPrograms])

  // 7 derniers jours glissants, comme "Séances 7 j" de l'Accueil (une semaine calendaire
  // affichait 1 séance le lundi matin quand l'Accueil en comptait 3).
  const weekStart = new Date(`${addDays(todayStr(), -6)}T00:00:00`).getTime()
  const weekSessions = useMemo(() => sessions.filter((s) => s.startedAt >= weekStart && !isSynthetic(s)), [sessions, weekStart])
  const weekDistance = weekSessions.reduce((s, e) => s + (e.distanceKm ?? 0), 0)
  const weekZone2Min = weekSessions.filter((s) => s.hrZone === 2).reduce((s, e) => s + e.durationMin, 0)
  // Même total que "kcal brûlées" de l'Accueil : sorties + activités + pas du quotidien.
  const todayCalories =
    sessions.filter((s) => isToday(s.startedAt)).reduce((sum, e) => sum + e.caloriesBurned, 0) +
    logs.filter((l) => isToday(l.loggedAt)).reduce((sum, l) => sum + l.caloriesBurned, 0)
  const lifeMetScore = Math.round(logs.filter((l) => isToday(l.loggedAt)).reduce((sum, l) => sum + l.metValue * (l.durationMin / 60), 0) * 10)

  // Démarrage rapide : les types réellement pratiqués, du plus récent au plus ancien.
  const quickTypes = useMemo(() => {
    const seen: EnduranceActivityType[] = []
    for (const s of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
      if (isSynthetic(s) || seen.includes(s.activityType)) continue
      seen.push(s.activityType)
    }
    for (const t of ['marche', 'course', 'velo'] as EnduranceActivityType[]) if (!seen.includes(t)) seen.push(t)
    return seen.slice(0, 5)
  }, [sessions])

  // Historique en liste groupée par jour (au lieu d'une navigation jour par jour).
  const historyGroups = useMemo(() => {
    const since = new Date(`${addDays(todayStr(), -(historyDays - 1))}T00:00:00`).getTime()
    const items: JournalItem[] = [
      ...sessions.filter((x) => x.startedAt >= since).map((session): JournalItem => ({ kind: 'session', at: session.startedAt, session })),
      ...logs.filter((l) => l.loggedAt >= since).map((log): JournalItem => ({ kind: 'activity', at: log.loggedAt, log })),
    ]
    const groups: { date: string; items: JournalItem[] }[] = []
    for (const item of items.sort((a, b) => b.at - a.at)) {
      const date = dayKey(item.at)
      const last = groups[groups.length - 1]
      if (last && last.date === date) last.items.push(item)
      else groups.push({ date, items: [item] })
    }
    // Sorties et activités d'abord, la marche auto (pas du jour) en fin de journée.
    const autoLast = (i: JournalItem) => Number(i.kind === 'session' && isSynthetic(i.session))
    for (const g of groups) g.items.sort((a, b) => autoLast(a) - autoLast(b) || b.at - a.at)
    return groups
  }, [sessions, logs, historyDays])
  const olderCount = useMemo(() => {
    const since = new Date(`${addDays(todayStr(), -(historyDays - 1))}T00:00:00`).getTime()
    return sessions.filter((x) => x.startedAt < since).length + logs.filter((l) => l.loggedAt < since).length
  }, [sessions, logs, historyDays])

  function openForm(type?: EnduranceActivityType) {
    setFormType(type)
    setFormOpen(true)
  }

  function dayLabel(date: string): string {
    if (date === todayStr()) return "Aujourd'hui"
    if (date === addDays(todayStr(), -1)) return 'Hier'
    return formatDate(new Date(`${date}T12:00:00`).getTime())
  }

  /** Activité du quotidien/loisir choisie dans "Qu'as-tu fait ?". */
  async function addActivity(entry: Omit<ActivityLog, 'id' | 'loggedAt'>, metId: string) {
    setAddOpen(false)
    const enduranceType = MET_TO_ENDURANCE[metId]
    if (enduranceType) {
      // Raccourci historique (ex. "Marche rapide" depuis la page Ajouter) : c'est une sortie.
      const saved = await logEnduranceSession(
        { activityType: enduranceType, durationMin: entry.durationMin, startedAt: Date.now() - entry.durationMin * 60_000 },
        settings,
      )
      if (saved.externalId) setNotice('Déjà enregistrée par ta montre : fusionnée, comptée une seule fois.')
    } else {
      const log: ActivityLog = { ...entry, id: newId(), loggedAt: Date.now(), source: 'manual' }
      const db = await getDb()
      await db.put('activities', log)
      pushRecord('activities', log.id, log)
      void pushActivityToNutriTracker({
        name: entry.label,
        activityType: MET_ACTIVITIES.find((a) => a.id === metId)?.googleFitType ?? 97,
        durationMin: entry.durationMin,
        caloriesBurned: entry.caloriesBurned,
        date: dayKey(log.loggedAt),
      })
    }
    refresh()
    // Les pas de cette activité ne doivent plus compter dans la marche auto du jour.
    void refreshFitData(settings).catch(() => {})
  }

  async function removeActivity(id: string) {
    if (!confirm('Supprimer cette activité ?')) return
    const db = await getDb()
    await db.delete('activities', id)
    deleteRecord('activities', id)
    refresh()
    void refreshFitData(settings).catch(() => {})
  }

  async function addSession(input: {
    activityType: EnduranceActivityType
    durationMin: number
    distanceKm?: number
    avgHeartRate?: number
    route?: RoutePoint[]
    caloriesBurned?: number
    machineStats?: MachineStats
    startedAt?: number
    photoDataUrl?: string
    rpe?: number
    programId?: string
    phaseLog?: PhaseLogEntry[]
    healthCapture?: HealthScreenCapture
  }) {
    const saved = await logEnduranceSession(input, settings)
    setFormOpen(false)
    // Une saisie neuve n'a jamais d'externalId : si elle en a un, c'est qu'elle a rejoint une séance importée.
    if (saved.externalId) {
      setNotice('Cette séance était déjà importée de ta montre : fusionnée en une seule, calories comptées une fois.')
    }
    refresh()
    // Recalcule la marche auto du jour (les pas d'une sortie à pied n'y comptent plus).
    void refreshFitData(settings).catch(() => {})
  }

  async function removeSession(id: string) {
    if (!confirm('Supprimer cette sortie ?')) return
    await deleteEnduranceSession(id)
    refresh()
  }

  const heroKey = loggedTypes[0]?.activityType ?? 'course'

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey={heroKey} className="h-40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <BackButton />
          <Activity className="text-teal-400" size={24} />
          <div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-white drop-shadow">Activité</h1>
            <p className="text-[11px] text-zinc-200 drop-shadow">Sorties, sport et quotidien</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
      <div className="glass mb-2 grid grid-cols-3 divide-x divide-zinc-800 rounded-2xl py-2.5 text-center" aria-label="Aujourd'hui">
        <div>
          <p className="text-lg font-bold text-orange-400">{todayCalories}</p>
          <p className="text-[10px] text-zinc-500">kcal aujourd'hui</p>
        </div>
        <div>
          <p className="text-lg font-bold text-teal-300">{(stepsByDay[todayStr()] ?? 0).toLocaleString('fr-FR')}</p>
          <p className="text-[10px] text-zinc-500">pas</p>
        </div>
        <div>
          <p className="text-lg font-bold text-zinc-100">{lifeMetScore}</p>
          <p className="text-[10px] text-zinc-500">Life MET</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="glass rounded-2xl p-3">
          <p className="text-[11px] text-zinc-500">Séances 7 j</p>
          <p className="mt-0.5 text-xl font-bold text-teal-400">{weekSessions.length}</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-[11px] text-zinc-500">Distance 7 j</p>
          <p className="mt-0.5 text-xl font-bold text-teal-400">
            {weekDistance.toFixed(1)}
            <span className="ml-0.5 text-xs font-medium">km</span>
          </p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-[11px] text-zinc-500">Zone 2 · 7 j</p>
          <p className="mt-0.5 text-xl font-bold text-teal-400">
            {weekZone2Min}
            <span className="ml-0.5 text-xs font-medium">min</span>
          </p>
        </div>
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-teal-500 py-3.5 text-sm font-semibold text-zinc-950 active:bg-teal-400"
      >
        <Plus size={16} /> Ajouter une activité
      </button>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Démarrage rapide">
        {quickTypes.map((t) => (
          <button
            key={t}
            onClick={() => openForm(t)}
            className="shrink-0 rounded-full bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 active:bg-zinc-800"
          >
            + {ENDURANCE_ACTIVITY_META[t].label}
          </button>
        ))}
        <button
          onClick={() => setAddOpen(true)}
          className="shrink-0 rounded-full bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 active:bg-zinc-800"
        >
          + Quotidien / loisir
        </button>
      </div>

      <div className="mb-5 mt-2 flex items-center justify-between gap-2 rounded-xl bg-zinc-900/60 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
          <Watch size={13} className="shrink-0 text-teal-300" />
          <span className="truncate">Montre · synchro {formatAgo(lastSync)}</span>
        </span>
        <button
          onClick={() => syncWatch(true)}
          disabled={syncing}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-teal-300 active:bg-zinc-800 disabled:opacity-60"
        >
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Synchroniser
        </button>
      </div>

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-200" role="status">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 rounded-full p-0.5 text-teal-300 active:bg-zinc-800" aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      )}

      <section className="mb-6">
        <button
          onClick={() => setCoachingOpen((v) => !v)}
          className="mb-2 flex w-full items-center justify-between text-sm font-medium text-zinc-400"
        >
          <span className="flex items-center gap-1.5">
            <Flame size={14} className="text-orange-400" /> Programmes Coaching — vélo & tapis
          </span>
          <ChevronDown size={16} className={`text-zinc-600 transition-transform ${coachingOpen ? 'rotate-180' : ''}`} />
        </button>
        <Collapsible open={coachingOpen}>
          <CoachingQuestions
            readiness={readiness}
            onReadiness={setReadiness}
            timeBudget={timeBudget}
            onTimeBudget={setTimeBudget}
            accentClass="bg-orange-500"
          />
          <div className="space-y-1.5">
            {visibleCoachingPrograms.length === 0 && (
              <p className="text-xs text-zinc-600">Aucun programme ne rentre dans ce temps — essaie un budget plus large.</p>
            )}
            {/* Regroupés par type d'activité (vélo/tapis/...), chaque groupe replié par défaut —
                sinon les 13+ modèles s'affichent tous d'un coup dès qu'on ouvre "Programmes Coaching". */}
            {programGroups.map(([activityType, programs]) => (
              <ProgramGroup
                key={activityType}
                activityType={activityType}
                programs={programs}
                customPrograms={customPrograms}
                onSelect={setPreviewProgram}
              />
            ))}
          </div>
          <button
            onClick={() => setBuilderOpen('new')}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-2.5 text-xs text-zinc-400 active:bg-zinc-900"
          >
            <Plus size={14} /> Créer un programme personnalisé
          </button>
        </Collapsible>
      </section>

      {loggedTypes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">Progression</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {loggedTypes.map(({ activityType }) => (
              <button
                key={activityType}
                onClick={() => navigate(`/endurance/history/${activityType}`)}
                className="glass flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium active:scale-95 transition-transform"
              >
                <TrendingUp size={13} className="text-teal-400" />
                {ENDURANCE_ACTIVITY_META[activityType].label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Journal</h2>
        {historyGroups.length === 0 && <p className="text-sm text-zinc-500">Rien sur les {historyDays} derniers jours.</p>}
        <div className="space-y-4">
          {historyGroups.map((g) => (
            <div key={g.date}>
              <p className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <span>{dayLabel(g.date)}</span>
                <span className="flex items-center gap-1.5 normal-case tracking-normal text-zinc-500">
                  {stepsByDay[g.date] != null && (
                    <span className="flex items-center gap-0.5">
                      <Footprints size={11} className="text-teal-400" />
                      {stepsByDay[g.date].toLocaleString('fr-FR')} pas ·
                    </span>
                  )}
                  {g.items.reduce((sum, x) => sum + (x.kind === 'session' ? x.session.caloriesBurned : x.log.caloriesBurned), 0)} kcal
                </span>
              </p>
              <ul className="space-y-2">
                {g.items.map((item) => {
                  if (item.kind === 'activity') return <ActivityLogRow key={item.log.id} log={item.log} onDelete={removeActivity} />
                  const s = item.session
                  return isSynthetic(s) ? (
                    <li key={s.id}>
                      <button
                        onClick={() => navigate(`/endurance/session/${s.id}`)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-zinc-800 px-3 py-2 text-left text-xs text-zinc-400 active:bg-zinc-900"
                      >
                        <Footprints size={14} className="shrink-0 text-teal-400" />
                        <span className="flex-1">
                          Pas du quotidien <span className="text-zinc-500">· {s.durationMin} min hors séances · auto</span>
                        </span>
                        <span className="font-semibold text-orange-400/80">{s.caloriesBurned} kcal</span>
                      </button>
                    </li>
                  ) : (
                    <SessionRow key={s.id} session={s} onOpen={() => navigate(`/endurance/session/${s.id}`)} onDelete={() => removeSession(s.id)} onPhoto={setViewerPhoto} />
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        {olderCount > 0 && (
          <button
            onClick={() => setHistoryDays((d) => d + 30)}
            className="mt-3 w-full rounded-xl py-2.5 text-xs font-medium text-zinc-400 active:bg-zinc-900"
          >
            Voir 30 jours de plus ({olderCount} plus ancienne{olderCount > 1 ? 's' : ''})
          </button>
        )}
      </section>

      {addOpen && (
        <AddActivitySheet
          filterIds={navState.filterIds}
          preferredTypes={quickTypes}
          onClose={() => setAddOpen(false)}
          onPickEndurance={(t) => {
            setAddOpen(false)
            openForm(t)
          }}
          onSubmitActivity={addActivity}
        />
      )}

      {formOpen && (
        <EnduranceForm
          onSubmit={addSession}
          onClose={() => {
            setFormOpen(false)
            setPendingProgram(null)
          }}
          initialScan={navState.scanResult}
          initialDate={todayStr()}
          initialProgram={pendingProgram}
          initialActivityType={formType}
        />
      )}

      {previewProgram && (
        <ProgramPreview
          program={previewProgram}
          onClose={() => setPreviewProgram(null)}
          onStart={() => {
            setPendingProgram(previewProgram)
            setPreviewProgram(null)
            setFormOpen(true)
          }}
          onEdit={
            customPrograms.some((cp) => cp.id === previewProgram.id)
              ? () => {
                  setBuilderOpen(customPrograms.find((cp) => cp.id === previewProgram.id) ?? null)
                  setPreviewProgram(null)
                }
              : undefined
          }
          onDelete={
            customPrograms.some((cp) => cp.id === previewProgram.id)
              ? async () => {
                  if (!confirm(`Supprimer le programme "${previewProgram.name}" ?`)) return
                  await deleteCustomEnduranceProgram(previewProgram.id)
                  setPreviewProgram(null)
                  refreshCustomPrograms()
                }
              : undefined
          }
        />
      )}

      {builderOpen && (
        <CustomProgramBuilder
          initial={builderOpen === 'new' ? undefined : builderOpen}
          onClose={() => setBuilderOpen(null)}
          onSave={async (program) => {
            await saveCustomEnduranceProgram(program)
            setBuilderOpen(null)
            refreshCustomPrograms()
          }}
        />
      )}

      {viewerPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewerPhoto(null)}>
          <img src={viewerPhoto} alt="Capture scannée" className="max-h-full max-w-full rounded-xl object-contain" />
          <button
            onClick={() => setViewerPhoto(null)}
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] rounded-full bg-zinc-950/60 p-2 text-white active:bg-zinc-900"
          >
            <X size={20} />
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

// Un groupe replié par type d'activité (vélo, tapis...) : évite d'afficher les 13+ modèles
// d'un coup dès qu'on déplie "Programmes Coaching".
function ProgramGroup({
  activityType,
  programs,
  customPrograms,
  onSelect,
}: {
  activityType: EnduranceActivityType
  programs: EnduranceProgram[]
  customPrograms: CustomEnduranceProgram[]
  onSelect: (p: EnduranceProgram) => void
}) {
  const [open, setOpen] = useCollapsible(`endurance-coaching-group-${activityType}`)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg bg-zinc-900/60 px-3 py-2 text-left text-xs font-medium text-zinc-300 active:bg-zinc-900"
      >
        <span>
          {ENDURANCE_ACTIVITY_META[activityType].label} <span className="text-zinc-600">· {programs.length}</span>
        </span>
        <ChevronDown size={14} className={`text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Collapsible open={open}>
        <div className="space-y-1.5 pt-1.5">
          {programs.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="glass flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left active:scale-[0.98] transition-transform"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">
                <Timer size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{p.name}</p>
                <p className="truncate text-[11px] leading-tight text-zinc-500">
                  {p.focus}
                  {customPrograms.some((cp) => cp.id === p.id) ? ' · perso' : ''}
                </p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-zinc-600" />
            </button>
          ))}
        </div>
      </Collapsible>
    </div>
  )
}

function SessionRow({
  session: s,
  onOpen,
  onDelete,
  onPhoto,
}: {
  session: EnduranceSession
  onOpen: () => void
  onDelete: () => void
  onPhoto: (dataUrl: string) => void
}) {
  const meta = ENDURANCE_ACTIVITY_META[s.activityType]
  const pace = s.distanceKm ? computePaceMinPerKm(s.durationMin, s.distanceKm) : null
  const zoneMeta = s.hrZone ? HR_ZONE_META[s.hrZone] : null
  return (
    <li onClick={onOpen} className="glass rounded-xl p-3 active:bg-zinc-900/80">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {s.photoDataUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPhoto(s.photoDataUrl!)
              }}
              className="shrink-0"
            >
              <img src={s.photoDataUrl} alt="Capture scannée" className="h-9 w-9 rounded-lg object-cover" />
            </button>
          )}
          <p className="truncate text-sm font-medium">{meta.label}</p>
          {s.externalId && (
            <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400" title="Importée de la montre / Google Fit">
              <Watch size={10} className="-mt-px mr-0.5 inline" />
              montre
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-xs text-zinc-500">{formatTime(s.startedAt)}</p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="shrink-0 rounded-full p-1 text-zinc-600 active:bg-red-500/10 active:text-red-400"
            aria-label="Supprimer la sortie"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Timer size={12} /> {s.durationMin} min
        </span>
        {s.distanceKm != null && s.distanceKm > 0 && (
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
      {s.machineStats && s.machineStats.machineType !== 'other' && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          {s.machineStats.avgWatts != null && <span>{s.machineStats.avgWatts} W moy.</span>}
          {s.machineStats.avgMets != null && <span>{s.machineStats.avgMets} METs</span>}
          {s.machineStats.peakHeartRate != null && <span>pic {s.machineStats.peakHeartRate} bpm</span>}
          {s.machineStats.peakWatts != null && <span>pic {s.machineStats.peakWatts} W</span>}
          {s.machineStats.elevationGainM != null && <span>+{s.machineStats.elevationGainM} m</span>}
        </div>
      )}
      {s.route && s.route.length > 1 && (
        <div className="mt-2">
          <RouteMap route={s.route} className="h-28 w-full" />
        </div>
      )}
    </li>
  )
}
