import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, ChevronDown, ChevronLeft, ChevronRight, Flame, HeartPulse, Plus, Route, Trash2, TrendingUp, Timer, X } from 'lucide-react'
import { ENDURANCE_ACTIVITY_META, computePaceMinPerKm, formatPace, getEnduranceSessions, logEnduranceSession, deleteEnduranceSession, getLoggedActivityTypes } from '../../lib/endurance'
import { getSettings } from '../../lib/settings'
import { HR_ZONE_META } from '../../lib/heartRate'
import { formatDate, formatTime, formatFullDate, isToday, isSameDay, todayStr, addDays } from '../../lib/date'
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
import type { EnduranceActivityType, EnduranceSession, HealthScreenCapture, MachineStats, PhaseLogEntry, RoutePoint } from '../../types'
import { ProgramPreview } from './ProgramPreview'
import { EnduranceForm } from './EnduranceForm'

interface NavState {
  openForm?: boolean
  scanResult?: ParsedMachineResult
}

function startOfWeek(): number {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // lundi = 0
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

export default function EndurancePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state as NavState) ?? {}
  const [sessions, setSessions] = useState<EnduranceSession[]>([])
  const [loggedTypes, setLoggedTypes] = useState<Array<{ activityType: EnduranceActivityType; lastDate: number }>>([])
  const [formOpen, setFormOpen] = useState(navState.openForm ?? false)
  const [selectedDate, setSelectedDate] = useState(todayStr())
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
    setLoggedTypes(await getLoggedActivityTypes())
  }

  useEffect(() => {
    refresh()
    refreshCustomPrograms()
  }, [])

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

  const weekStart = startOfWeek()
  const weekSessions = useMemo(() => sessions.filter((s) => s.startedAt >= weekStart), [sessions, weekStart])
  const daySessions = useMemo(() => sessions.filter((s) => isSameDay(s.startedAt, selectedDate)), [sessions, selectedDate])
  const weekDistance = weekSessions.reduce((s, e) => s + (e.distanceKm ?? 0), 0)
  const weekZone2Min = weekSessions.filter((s) => s.hrZone === 2).reduce((s, e) => s + e.durationMin, 0)
  const todayCalories = sessions.filter((s) => isToday(s.startedAt)).reduce((s, e) => s + e.caloriesBurned, 0)

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
    await logEnduranceSession(input, settings)
    setFormOpen(false)
    refresh()
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
          <h1 className="text-xl font-semibold tracking-tight text-white drop-shadow">Endurance</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
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

      <button
        onClick={() => setFormOpen(true)}
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
      >
        <Plus size={16} /> Enregistrer une sortie
      </button>

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
        <div className="glass mb-3 flex items-center justify-between rounded-2xl p-2">
          <button
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            className="rounded-full p-2 text-zinc-400 active:bg-zinc-900"
            aria-label="Jour précédent"
          >
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setSelectedDate(todayStr())} className="flex-1 text-center text-sm font-medium capitalize">
            {formatFullDate(selectedDate)}
          </button>
          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            disabled={selectedDate >= todayStr()}
            className="rounded-full p-2 text-zinc-400 active:bg-zinc-900 disabled:opacity-30"
            aria-label="Jour suivant"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <h2 className="mb-2 text-sm font-medium text-zinc-400">Historique</h2>
        {daySessions.length === 0 && <p className="text-sm text-zinc-500">Rien ce jour-là.</p>}
        <ul className="space-y-2">
          {daySessions.map((s) => {
            const meta = ENDURANCE_ACTIVITY_META[s.activityType]
            const pace = s.distanceKm ? computePaceMinPerKm(s.durationMin, s.distanceKm) : null
            const zoneMeta = s.hrZone ? HR_ZONE_META[s.hrZone] : null
            return (
              <li
                key={s.id}
                onClick={() => navigate(`/endurance/session/${s.id}`)}
                className="glass rounded-xl p-3 active:bg-zinc-900/80"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {s.photoDataUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewerPhoto(s.photoDataUrl!)
                        }}
                        className="shrink-0"
                      >
                        <img src={s.photoDataUrl} alt="Capture scannée" className="h-9 w-9 rounded-lg object-cover" />
                      </button>
                    )}
                    <p className="text-sm font-medium">{meta.label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-500">
                      {formatDate(s.startedAt)} · {formatTime(s.startedAt)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSession(s.id)
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
                {s.machineStats && (
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
          })}
        </ul>
      </section>

      {formOpen && (
        <EnduranceForm
          onSubmit={addSession}
          onClose={() => {
            setFormOpen(false)
            setPendingProgram(null)
          }}
          initialScan={navState.scanResult}
          initialDate={selectedDate}
          initialProgram={pendingProgram}
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
