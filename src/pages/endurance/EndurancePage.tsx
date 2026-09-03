import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  HeartPulse,
  Loader2,
  MapPin,
  Pause,
  Plus,
  Route,
  SkipForward,
  Trash2,
  TrendingUp,
  Timer,
  X,
} from 'lucide-react'
import {
  ENDURANCE_ACTIVITY_META,
  computePaceMinPerKm,
  formatPace,
  getEnduranceSessions,
  logEnduranceSession,
  deleteEnduranceSession,
  getLoggedActivityTypes,
} from '../../lib/endurance'
import { getSettings } from '../../lib/settings'
import { HR_ZONE_META } from '../../lib/heartRate'
import { formatDate, formatTime, formatFullDate, isToday, isSameDay, todayStr, addDays } from '../../lib/date'
import { useGeoTracking } from '../../lib/useGeoTracking'
import { playMotivation, playAnnouncement } from '../../lib/motivationVoice'
import { scanMachineResults, machineTypeToActivityType, toMachineStats, compressImageForDisplay, type ParsedMachineResult } from '../../lib/machineScan'
import { scanHealthScreen, computeHrr1min } from '../../lib/healthScreenScan'
import { ENDURANCE_PROGRAMS, programDurationMin, type EnduranceProgram, type ProgramPhase } from '../../lib/endurancePrograms'
import {
  getCustomEndurancePrograms,
  saveCustomEnduranceProgram,
  deleteCustomEnduranceProgram,
  type CustomEnduranceProgram,
} from '../../lib/customEndurancePrograms'
import { fitsTimeBudget, readinessMatchScore, type Readiness, type TimeBudget } from '../../lib/coachingFilter'
import CoachingQuestions from '../../components/CoachingQuestions'
import ProgramProfileChart from '../../components/ProgramProfileChart'
import CustomProgramBuilder from './CustomProgramBuilder'
import RouteMap from '../../components/RouteMap'
import ActivityHero, { hasHeroImage } from '../../components/ActivityHero'
import BackButton from '../../components/BackButton'
import type { EnduranceActivityType, EnduranceSession, HealthScreenCapture, MachineStats, PhaseLogEntry, RoutePoint } from '../../types'

// Palette de l'app (index.css @theme), pas des couleurs Tailwind par défaut —
// turquoise/indigo/orange sont les 3 seuls accents de l'identité visuelle.
const INTENSITY_COLOR: Record<ProgramPhase['intensity'], string> = {
  facile: 'var(--color-turquoise)',
  modéré: 'var(--color-indigo)',
  dur: 'var(--color-orange)',
}

// Même échelle session-RPE que le mode Focus musculation (WorkoutRunner) —
// cohérence de vocabulaire entre les deux modules.
const DIFFICULTY_LEVELS: Array<{ label: string; rpe: number; color: string }> = [
  { label: 'Facile', rpe: 3, color: 'bg-teal-500/15 text-teal-400' },
  { label: 'Modéré', rpe: 5, color: 'bg-teal-500/15 text-teal-400' },
  { label: 'Difficile', rpe: 7, color: 'bg-orange-500/15 text-orange-400' },
  { label: 'Très difficile', rpe: 8.5, color: 'bg-orange-500/15 text-orange-400' },
  { label: 'Effort maximal', rpe: 10, color: 'bg-red-500/15 text-red-400' },
]

/** Phase active à un instant donné du programme, ou null si le programme est terminé. */
function getPhaseAt(program: EnduranceProgram, elapsedSec: number): { index: number; phase: ProgramPhase; remainingSec: number } | null {
  let acc = 0
  for (let i = 0; i < program.phases.length; i++) {
    const p = program.phases[i]
    if (elapsedSec < acc + p.durationSec) return { index: i, phase: p, remainingSec: acc + p.durationSec - elapsedSec }
    acc += p.durationSec
  }
  return null
}

function programTotalSec(program: EnduranceProgram): number {
  return program.phases.reduce((s, p) => s + p.durationSec, 0)
}

interface NavState {
  openForm?: boolean
  scanResult?: ParsedMachineResult
}

// Activités où un suivi GPS a du sens (extérieur, mouvement continu).
const GPS_CAPABLE: EnduranceActivityType[] = ['course', 'velo', 'marche']
// Machines d'intérieur — pas de GPS, mais un chrono live avec voix de
// motivation périodique a quand même du sens (tapis, vélo de salle).
const INDOOR_TYPES: EnduranceActivityType[] = ['tapis', 'velo-appart']
// Fréquence des relances vocales pendant une séance live (indoor ou GPS).
const MOTIVATION_INTERVAL_SEC = 180

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
  const [coachingOpen, setCoachingOpen] = useState(false)
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
        {coachingOpen && (
          <>
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
              {visibleCoachingPrograms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreviewProgram(p)}
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
            <button
              onClick={() => setBuilderOpen('new')}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-2.5 text-xs text-zinc-400 active:bg-zinc-900"
            >
              <Plus size={14} /> Créer un programme personnalisé
            </button>
          </>
        )}
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

function formatPhaseDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  return `${min} min`
}

/** Profil d'intervalles façon appli de fractionné — un bloc par phase, largeur
 * proportionnelle à sa durée, couleur = intensité, curseur = position réelle.
 * Donne une vue d'ensemble du programme (passé/en cours/à venir) qu'un simple
 * % de progression ne montre pas. */
function IntervalProfile({
  program,
  elapsedSec,
  currentIndex,
  showCursor = true,
}: {
  program: EnduranceProgram
  elapsedSec: number
  currentIndex: number
  showCursor?: boolean
}) {
  const total = programTotalSec(program)
  return (
    <div className="relative mb-2 w-full max-w-sm">
      <div className="flex h-7 w-full overflow-hidden rounded-lg bg-zinc-900">
        {program.phases.map((p, i) => (
          <div
            key={i}
            className="h-full border-r border-black/30 last:border-r-0"
            style={{
              flexGrow: p.durationSec,
              flexBasis: 0,
              backgroundColor: INTENSITY_COLOR[p.intensity],
              opacity: i === currentIndex ? 1 : i < currentIndex ? 0.3 : 0.55,
            }}
          />
        ))}
      </div>
      {showCursor && (
        <div
          className="absolute top-0 h-7 w-0.5 bg-white transition-all"
          style={{ left: `${Math.min(100, (elapsedSec / total) * 100)}%`, boxShadow: '0 0 4px rgba(255,255,255,0.8)' }}
        />
      )}
    </div>
  )
}

function ProgramPreview({
  program,
  onClose,
  onStart,
  onEdit,
  onDelete,
}: {
  program: EnduranceProgram
  onClose: () => void
  onStart: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const meta = ENDURANCE_ACTIVITY_META[program.activityType]
  const totalMin = Math.round(programTotalSec(program) / 60)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">{program.name}</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-orange-400">
            {meta.label} · {totalMin} min
          </p>
          <p className="mb-3 text-sm text-zinc-400">{program.description}</p>

          {program.phases.length > 1 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] text-zinc-600">Fractionnement</p>
              <IntervalProfile program={program} elapsedSec={0} currentIndex={-1} showCursor={false} />
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-600">
                {(['facile', 'modéré', 'dur'] as const).map((i) => (
                  <span key={i} className="flex items-center gap-1 capitalize">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: INTENSITY_COLOR[i] }} /> {i}
                  </span>
                ))}
              </div>
            </div>
          )}

          {program.activityType === 'tapis' && <ProgramProfileChart phases={program.phases} />}

          <p className="mb-2 text-[11px] text-zinc-600">Déroulé</p>
          <ul className="mb-3 space-y-1.5">
            {program.phases.map((p, i) => (
              <li key={i} className="glass rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: INTENSITY_COLOR[p.intensity] }} />
                    {p.label}
                  </span>
                  <span className="font-mono text-zinc-500">{formatPhaseDuration(p.durationSec)}</span>
                </div>
                {p.target && <p className="mt-0.5 pl-4 text-[11px] text-zinc-500">{p.target}</p>}
              </li>
            ))}
          </ul>

          <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">{program.fallbackNote}</p>
          </div>

          {program.muscuAddOn && (
            <div className="mb-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-400">
                <Flame size={13} /> {program.muscuAddOn.label}
              </p>
              <p className="text-xs leading-relaxed text-zinc-400">{program.muscuAddOn.description}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          {(onEdit || onDelete) && (
            <div className="mb-2 flex gap-2">
              {onEdit && (
                <button onClick={onEdit} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-xs font-medium text-zinc-300 active:bg-zinc-900">
                  Modifier
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} className="flex-1 rounded-xl border border-red-500/30 py-2.5 text-xs font-medium text-red-400 active:bg-red-500/10">
                  Supprimer
                </button>
              )}
            </div>
          )}
          <button onClick={onStart} className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400">
            Démarrer
          </button>
        </div>
      </div>
    </div>
  )
}

function EnduranceForm({
  onSubmit,
  onClose,
  initialScan,
  initialDate,
  initialProgram,
}: {
  onSubmit: (input: {
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
  }) => void
  onClose: () => void
  initialScan?: ParsedMachineResult
  initialDate: string
  initialProgram?: EnduranceProgram | null
}) {
  const [activityType, setActivityType] = useState<EnduranceActivityType>(
    initialScan ? machineTypeToActivityType(initialScan.machineType) : initialProgram ? initialProgram.activityType : 'course',
  )
  const [duration, setDuration] = useState(initialScan?.durationMin ? String(initialScan.durationMin) : '30')
  const [distance, setDistance] = useState(initialScan?.distanceKm ? String(initialScan.distanceKm) : '')
  const [avgHr, setAvgHr] = useState(initialScan?.avgHeartRate ? String(initialScan.avgHeartRate) : '')
  const [date, setDate] = useState(initialDate)
  const meta = ENDURANCE_ACTIVITY_META[activityType]
  const gps = useGeoTracking()
  const gpsCapable = GPS_CAPABLE.includes(activityType)
  const indoorCapable = INDOOR_TYPES.includes(activityType)
  const [indoorRunning, setIndoorRunning] = useState(false)
  const [indoorElapsedSec, setIndoorElapsedSec] = useState(0)
  const [activeProgram, setActiveProgram] = useState<EnduranceProgram | null>(null)
  const [awaitingDifficulty, setAwaitingDifficulty] = useState(false)
  const [sessionRpe, setSessionRpe] = useState<number | null>(null)
  const [suggestScan, setSuggestScan] = useState(false)
  const indoorStartRef = useRef(0)
  const indoorIntervalRef = useRef<number | null>(null)
  const prevPhaseIndexRef = useRef<number | null>(null)
  const programDoneRef = useRef(false)
  const phaseStartSecRef = useRef(0)
  const phaseLogRef = useRef<PhaseLogEntry[]>([])
  const settings = getSettings()

  useEffect(() => {
    return () => {
      if (indoorIntervalRef.current != null) window.clearInterval(indoorIntervalRef.current)
    }
  }, [])

  // Programme lancé depuis la page Endurance ("Démarrer" dans l'aperçu) —
  // saute directement dans le chrono guidé plutôt que de repasser par le
  // formulaire, une fois le type d'activité déjà pré-sélectionné.
  useEffect(() => {
    if (initialProgram) startIndoorChrono(initialProgram)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [savedRoute, setSavedRoute] = useState<RoutePoint[] | null>(null)
  const [scanCalories, setScanCalories] = useState<number | null>(initialScan?.calories ?? null)
  const [scanStats, setScanStats] = useState<MachineStats | null>(initialScan ? toMachineStats(initialScan) : null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [healthCapture, setHealthCapture] = useState<HealthScreenCapture | null>(null)
  const [healthScanning, setHealthScanning] = useState(false)
  const [healthScanError, setHealthScanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const healthFileInputRef = useRef<HTMLInputElement>(null)

  function applyScanResult(result: ParsedMachineResult) {
    setActivityType(machineTypeToActivityType(result.machineType))
    if (result.durationMin) setDuration(String(result.durationMin))
    if (result.distanceKm) setDistance(String(result.distanceKm))
    if (result.avgHeartRate) setAvgHr(String(result.avgHeartRate))
    setScanCalories(result.calories ?? null)
    setScanStats(toMachineStats(result))
  }

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setScanning(true)
    setScanError(null)
    try {
      compressImageForDisplay(files[0]).then(setPhotoDataUrl)
      applyScanResult(await scanMachineResults(files))
    } catch (err) {
      const detail = err instanceof Error ? err.message : ''
      setScanError(`Impossible de lire ${files.length > 1 ? 'ces photos' : 'cette photo'}${detail ? ` (${detail})` : ''} — remplis les champs manuellement.`)
    } finally {
      setScanning(false)
    }
  }

  async function handleHealthScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setHealthScanning(true)
    setHealthScanError(null)
    try {
      const capture = await scanHealthScreen(file)
      setHealthCapture(capture)
      if (capture.avgBpm) setAvgHr(String(capture.avgBpm))
    } catch (err) {
      const detail = err instanceof Error ? err.message : ''
      setHealthScanError(`Impossible de lire cette capture${detail ? ` (${detail})` : ''}.`)
    } finally {
      setHealthScanning(false)
    }
  }

  function submit() {
    const dur = parseInt(duration, 10)
    if (!dur) return
    onSubmit({
      activityType,
      durationMin: dur,
      distanceKm: distance ? parseFloat(distance) : undefined,
      avgHeartRate: avgHr ? parseInt(avgHr, 10) : undefined,
      route: savedRoute ?? undefined,
      caloriesBurned: scanCalories ?? undefined,
      machineStats: scanStats ?? undefined,
      startedAt: date === todayStr() ? Date.now() : new Date(`${date}T12:00:00`).getTime(),
      photoDataUrl: photoDataUrl ?? undefined,
      rpe: sessionRpe ?? undefined,
      programId: activeProgram?.id,
      phaseLog: phaseLogRef.current.length > 0 ? phaseLogRef.current : undefined,
      healthCapture: healthCapture ?? undefined,
    })
  }

  function stopTracking() {
    const final = gps.stop()
    setDuration(String(Math.max(1, Math.round(final.elapsedSec / 60))))
    setDistance(final.distanceKm.toFixed(2))
    setSavedRoute(final.route)
  }

  /** Clôt la phase en cours dans le journal (durée réelle, pas planifiée) et
   * repart d'ici pour la suivante — appelé aux transitions naturelles, à un
   * "Passer", et à l'arrêt de la séance (phase alors partielle). */
  function recordPhaseCompletion(program: EnduranceProgram, phaseIndex: number, endedAtElapsedSec: number) {
    const phase = program.phases[phaseIndex]
    const actualSec = Math.max(0, endedAtElapsedSec - phaseStartSecRef.current)
    phaseLogRef.current.push({ label: phase.label, intensity: phase.intensity, plannedSec: phase.durationSec, actualSec })
    phaseStartSecRef.current = endedAtElapsedSec
  }

  function startIndoorChrono(program?: EnduranceProgram) {
    indoorStartRef.current = Date.now()
    setIndoorElapsedSec(0)
    setIndoorRunning(true)
    setActiveProgram(program ?? null)
    prevPhaseIndexRef.current = null
    programDoneRef.current = false
    phaseStartSecRef.current = 0
    phaseLogRef.current = []
    let lastFiredAt = 0
    indoorIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - indoorStartRef.current) / 1000)
      setIndoorElapsedSec(elapsed)

      if (program) {
        const current = getPhaseAt(program, elapsed)
        if (current) {
          if (prevPhaseIndexRef.current !== null && prevPhaseIndexRef.current !== current.index) {
            // Changement de phase — retour haptique + annonce vocale du
            // libellé (synthèse directe, sans Groq : voir playAnnouncement).
            navigator.vibrate?.(current.phase.intensity === 'dur' ? [120, 60, 120] : 120)
            if (settings.motivationVoice !== 'off') void playAnnouncement(settings.motivationVoice, current.phase.label)
            recordPhaseCompletion(program, prevPhaseIndexRef.current, elapsed)
          }
          prevPhaseIndexRef.current = current.index
        } else if (!programDoneRef.current) {
          programDoneRef.current = true
          navigator.vibrate?.([200, 100, 200, 100, 200])
          if (settings.motivationVoice !== 'off') void playAnnouncement(settings.motivationVoice, 'Programme terminé, bravo')
          if (prevPhaseIndexRef.current !== null) recordPhaseCompletion(program, prevPhaseIndexRef.current, elapsed)
        }
      }

      if (settings.motivationVoice !== 'off' && elapsed - lastFiredAt >= MOTIVATION_INTERVAL_SEC) {
        lastFiredAt = elapsed
        void playMotivation(settings.motivationVoice, {
          kind: 'cardio',
          activityType: meta.label,
          elapsedMin: Math.round(elapsed / 60),
        })
      }
    }, 1000)
  }

  function stopIndoorChrono() {
    if (indoorIntervalRef.current != null) window.clearInterval(indoorIntervalRef.current)
    indoorIntervalRef.current = null
    const nowElapsed = Math.round((Date.now() - indoorStartRef.current) / 1000)
    if (activeProgram && !programDoneRef.current) {
      const current = getPhaseAt(activeProgram, nowElapsed)
      if (current) recordPhaseCompletion(activeProgram, current.index, nowElapsed)
    }
    setIndoorRunning(false)
    setIndoorElapsedSec(nowElapsed)
    setDuration(String(Math.max(1, Math.round(nowElapsed / 60))))
    setAwaitingDifficulty(true)
  }

  function pickDifficulty(rpe: number | null) {
    setSessionRpe(rpe)
    setAwaitingDifficulty(false)
    setSuggestScan(true)
  }

  /** Saute directement à la phase suivante du programme — recule l'heure de
   * départ perçue plutôt que de gérer un état séparé, pour que le reste du
   * chrono (getPhaseAt, profil d'intervalles) continue de dériver la phase
   * courante d'une seule source de vérité (le temps écoulé). */
  function skipPhase() {
    if (!activeProgram) return
    // Lit le temps réel écoulé depuis la ref (source de vérité), pas depuis
    // indoorElapsedSec — un "Passer" tapé deux fois avant le prochain rendu
    // verrait sinon un state React périmé et lograit deux fois la même phase.
    const nowElapsed = Math.round((Date.now() - indoorStartRef.current) / 1000)
    const current = getPhaseAt(activeProgram, nowElapsed)
    if (!current) return
    recordPhaseCompletion(activeProgram, current.index, nowElapsed)
    const jumpTo = nowElapsed + current.remainingSec
    indoorStartRef.current = Date.now() - jumpTo * 1000
    setIndoorElapsedSec(jumpTo)
    const next = getPhaseAt(activeProgram, jumpTo)
    if (next) {
      prevPhaseIndexRef.current = next.index
      navigator.vibrate?.(next.phase.intensity === 'dur' ? [120, 60, 120] : 120)
      if (settings.motivationVoice !== 'off') void playAnnouncement(settings.motivationVoice, next.phase.label)
    } else {
      programDoneRef.current = true
      navigator.vibrate?.([200, 100, 200, 100, 200])
    }
  }

  if (indoorRunning) {
    const mm = Math.floor(indoorElapsedSec / 60)
    const ss = indoorElapsedSec % 60
    const current = activeProgram ? getPhaseAt(activeProgram, indoorElapsedSec) : null
    const totalSec = activeProgram ? programTotalSec(activeProgram) : null

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-zinc-950 px-6 py-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-400">
          {activeProgram ? activeProgram.name : `${meta.label} en direct`}
        </p>

        {activeProgram && current && (
          <>
            <p className="mb-1 text-lg font-semibold" style={{ color: INTENSITY_COLOR[current.phase.intensity] }}>
              {current.phase.label}
            </p>
            <p className="mb-1 font-mono text-6xl font-bold tabular-nums" style={{ color: INTENSITY_COLOR[current.phase.intensity] }}>
              {Math.floor(current.remainingSec / 60)}:{String(current.remainingSec % 60).padStart(2, '0')}
            </p>
            <p className="mb-6 text-sm text-zinc-400">{current.phase.target ?? ' '}</p>
            <IntervalProfile program={activeProgram} elapsedSec={indoorElapsedSec} currentIndex={current.index} />
            <p className="mb-10 text-xs text-zinc-600">
              {mm}:{String(ss).padStart(2, '0')} écoulées {totalSec ? `sur ${Math.round(totalSec / 60)} min` : ''}
            </p>
          </>
        )}

        {activeProgram && !current && (
          <>
            <p className="mb-2 text-lg font-semibold text-teal-400">Programme terminé 🎉</p>
            <p className="mb-10 font-mono text-4xl font-bold tabular-nums text-zinc-500">
              {mm}:{String(ss).padStart(2, '0')}
            </p>
          </>
        )}

        {!activeProgram && (
          <p className="mb-10 font-mono text-6xl font-bold tabular-nums">
            {mm}:{String(ss).padStart(2, '0')}
          </p>
        )}

        {settings.motivationVoice !== 'off' && (
          <p className="mb-10 text-center text-xs text-zinc-500">Une relance vocale toutes les {MOTIVATION_INTERVAL_SEC / 60} min</p>
        )}
        <div className="flex items-center gap-2.5">
          {activeProgram && current && (
            <button
              onClick={skipPhase}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-300 active:bg-zinc-700"
            >
              <SkipForward size={16} /> Passer
            </button>
          )}
          <button
            onClick={stopIndoorChrono}
            className="flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-8 py-4 text-sm font-semibold text-white active:bg-red-400"
          >
            <Pause size={16} fill="currentColor" /> Terminer la séance
          </button>
        </div>
      </div>
    )
  }

  if (awaitingDifficulty) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-zinc-950 px-6 py-8">
        <p className="mb-2 text-lg font-semibold">Difficulté ressentie ?</p>
        <p className="mb-4 text-center text-xs text-zinc-500">Aide à calculer ta charge d'entraînement réelle.</p>
        {DIFFICULTY_LEVELS.map((lvl) => (
          <button
            key={lvl.label}
            onClick={() => pickDifficulty(lvl.rpe)}
            className={`w-full max-w-xs rounded-xl py-3 text-sm font-semibold active:opacity-80 ${lvl.color}`}
          >
            {lvl.label}
          </button>
        ))}
        <button onClick={() => pickDifficulty(null)} className="mt-2 text-xs text-zinc-600 active:text-zinc-400">
          Passer cette évaluation
        </button>
      </div>
    )
  }

  if (gps.tracking) {
    const mm = Math.floor(gps.elapsedSec / 60)
    const ss = gps.elapsedSec % 60
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-zinc-950">
        <div className="relative">
          {hasHeroImage(activityType) && <ActivityHero heroKey={activityType} className="h-44" />}
          <div
            className={`flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] ${
              hasHeroImage(activityType) ? 'absolute inset-x-0 top-0' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 text-teal-300">
              <MapPin size={16} className="animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wide drop-shadow">Suivi en direct · {meta.label}</span>
            </div>
            <button onClick={onClose} className="rounded-full bg-zinc-950/40 p-1.5 text-zinc-200 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
        </div>

        {gps.error && <p className="mx-4 mb-2 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{gps.error}</p>}

        <div className="px-4">
          <RouteMap route={gps.route} live className="h-64 w-full" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 px-4">
          <div className="glass rounded-2xl p-4 text-center">
            <p className="text-xs text-zinc-500">Distance</p>
            <p className="text-2xl font-bold text-teal-400">{gps.distanceKm.toFixed(2)} km</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <p className="text-xs text-zinc-500">Durée</p>
            <p className="text-2xl font-bold text-teal-400">
              {mm}:{String(ss).padStart(2, '0')}
            </p>
          </div>
        </div>

        <button
          onClick={stopTracking}
          className="mx-4 mt-6 flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-4 text-sm font-semibold text-white active:bg-red-400"
        >
          <Pause size={16} fill="currentColor" /> Terminer la sortie
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className={`flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-t border-zinc-800 bg-zinc-950 ${
          hasHeroImage(activityType) ? '' : 'mesh-backdrop'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeroImage(activityType) ? (
          <div className="relative shrink-0">
            <ActivityHero heroKey={activityType} className="h-32 rounded-t-2xl" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
              <h2 className="font-semibold text-white drop-shadow">Nouvelle sortie</h2>
              <button onClick={onClose} className="rounded-full bg-zinc-950/40 p-1 text-white active:bg-zinc-900">
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3 flex shrink-0 items-center justify-between p-4 pb-0">
            <h2 className="font-semibold">Nouvelle sortie</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 pt-3">
        {suggestScan && !scanStats && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
            <Camera size={16} className="mt-0.5 shrink-0 text-orange-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-orange-400">Machine indoor ?</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                Prends l'écran de la machine en photo pour récupérer les calories et stats exactes, plutôt que les estimer.
              </p>
              <button onClick={() => fileInputRef.current?.click()} className="mt-1.5 text-[11px] font-semibold text-orange-400 active:text-orange-300">
                Scanner maintenant
              </button>
            </div>
            <button onClick={() => setSuggestScan(false)} className="shrink-0 rounded-full p-0.5 text-zinc-600 active:bg-zinc-800">
              <X size={14} />
            </button>
          </div>
        )}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleScanFile}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 py-3 text-sm font-semibold text-orange-400 active:bg-orange-500/20 disabled:opacity-60"
        >
          {scanning ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Analyse de la/des photo(s)…
            </>
          ) : (
            <>
              <Camera size={16} /> Scanner un résultat machine
            </>
          )}
        </button>
        <p className="mb-2 text-center text-[11px] text-zinc-600">
          Tu peux sélectionner plusieurs photos si le tableau ne tient pas sur un seul écran.
        </p>
        {scanError && <p className="mb-3 text-center text-xs text-red-400">{scanError}</p>}
        {scanStats && !scanError && (
          <div className="mb-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
            <div className="mb-1.5 flex items-center justify-center gap-2">
              {photoDataUrl && (
                <button type="button" onClick={() => setPhotoViewerOpen(true)} className="shrink-0">
                  <img src={photoDataUrl} alt="Capture scannée" className="h-10 w-10 rounded-lg object-cover" />
                </button>
              )}
              <p className="text-center text-xs font-medium text-orange-400">Photo(s) analysée(s)</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
              {scanCalories != null && <span>{scanCalories} kcal</span>}
              {scanStats.avgWatts != null && <span>{scanStats.avgWatts} W moy.</span>}
              {scanStats.avgSpeedKph != null && <span>{scanStats.avgSpeedKph} km/h moy.</span>}
              {scanStats.avgMets != null && <span>{scanStats.avgMets} METs</span>}
              {scanStats.peakHeartRate != null && <span>pic {scanStats.peakHeartRate} bpm</span>}
              {scanStats.peakWatts != null && <span>pic {scanStats.peakWatts} W</span>}
              {scanStats.peakSpeedKph != null && <span>pic {scanStats.peakSpeedKph} km/h</span>}
              {scanStats.elevationGainM != null && <span>+{scanStats.elevationGainM} m dénivelé</span>}
            </div>
          </div>
        )}

        <input
          ref={healthFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleHealthScan}
        />
        <button
          onClick={() => healthFileInputRef.current?.click()}
          disabled={healthScanning}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 py-3 text-sm font-semibold text-indigo-400 active:bg-indigo-500/20 disabled:opacity-60"
        >
          {healthScanning ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Analyse de la capture…
            </>
          ) : (
            <>
              <HeartPulse size={16} /> Importer Apple Health / Google Fit
            </>
          )}
        </button>
        <p className="mb-2 text-center text-[11px] text-zinc-600">
          Capture d'écran du détail "Fréquence cardiaque" de ta séance — zones et récupération.
        </p>
        {healthScanError && <p className="mb-3 text-center text-xs text-red-400">{healthScanError}</p>}
        {healthCapture && !healthScanError && (
          <div className="mb-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3">
            <div className="mb-1.5 flex items-center justify-center gap-2">
              {healthCapture.screenshotDataUrl && (
                <img src={healthCapture.screenshotDataUrl} alt="Capture Apple Health" className="h-10 w-10 rounded-lg object-cover" />
              )}
              <p className="text-center text-xs font-medium text-indigo-400">Données cardiaques importées</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
              {healthCapture.avgBpm != null && <span>{healthCapture.avgBpm} bpm moy.</span>}
              {healthCapture.zoneBreakdown.length > 0 && <span>{healthCapture.zoneBreakdown.length} zones FC</span>}
              {(() => {
                const hrr = computeHrr1min(healthCapture.recoveryPoints)
                return hrr != null ? <span>récup 1min : -{hrr} bpm</span> : null
              })()}
            </div>
          </div>
        )}

        <label className="mb-1 block text-xs text-zinc-500">Date de la séance</label>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
        />
        <p className="-mt-2 mb-4 text-center text-[11px] text-zinc-600">
          Photo prise plus tard ? Change la date pour l'attribuer au bon jour.
        </p>

        {gpsCapable && (
          <button
            onClick={() => {
              setSavedRoute(null)
              gps.start()
            }}
            className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-500/10 py-3 text-sm font-semibold text-teal-400 active:bg-teal-500/20"
          >
            <MapPin size={16} /> Suivre en direct (GPS)
          </button>
        )}

        {indoorCapable && (
          <button
            onClick={() => startIndoorChrono()}
            className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-500/10 py-3 text-sm font-semibold text-teal-400 active:bg-teal-500/20"
          >
            <Timer size={16} /> Démarrer le chrono en direct
          </button>
        )}

        {savedRoute && (
          <div className="mb-3">
            <RouteMap route={savedRoute} className="h-32 w-full" />
          </div>
        )}

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
          className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
        />
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={submit}
            className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
          >
            Enregistrer
          </button>
        </div>
      </div>

      {photoViewerOpen && photoDataUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setPhotoViewerOpen(false)}>
          <img src={photoDataUrl} alt="Capture scannée" className="max-h-full max-w-full rounded-xl object-contain" />
          <button
            onClick={() => setPhotoViewerOpen(false)}
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] rounded-full bg-zinc-950/60 p-2 text-white active:bg-zinc-900"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
