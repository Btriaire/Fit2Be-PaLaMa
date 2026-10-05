import { useEffect, useRef, useState } from 'react'
import { Camera, HeartPulse, Loader2, MapPin, Pause, Pencil, SkipForward, Timer, X } from 'lucide-react'
import { ENDURANCE_ACTIVITY_META } from '../../lib/endurance'
import { getSettings } from '../../lib/settings'
import { todayStr } from '../../lib/date'
import { useGeoTracking } from '../../lib/useGeoTracking'
import { playMotivation, playAnnouncement } from '../../lib/motivationVoice'
import { scanMachineResults, machineTypeToActivityType, toMachineStats, compressImageForDisplay, type ParsedMachineResult } from '../../lib/machineScan'
import { scanHealthScreen, computeHrr1min } from '../../lib/healthScreenScan'
import { type EnduranceProgram } from '../../lib/endurancePrograms'
import RouteMap from '../../components/RouteMap'
import ActivityHero, { hasHeroImage } from '../../components/ActivityHero'
import type { EnduranceActivityType, HealthScreenCapture, MachineStats, PhaseLogEntry, RoutePoint } from '../../types'
import { DIFFICULTY_LEVELS, GPS_CAPABLE, INDOOR_TYPES, INTENSITY_COLOR, MOTIVATION_INTERVAL_SEC, getPhaseAt, programTotalSec } from './enduranceShared'
import { IntervalProfile } from './IntervalProfile'

export function EnduranceForm({
  onSubmit,
  onClose,
  initialScan,
  initialDate,
  initialProgram,
  initialActivityType,
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
  /** Type pré-sélectionné (boutons de démarrage rapide de la page Endurance). */
  initialActivityType?: EnduranceActivityType
}) {
  const [activityType, setActivityType] = useState<EnduranceActivityType>(
    initialScan
      ? machineTypeToActivityType(initialScan.machineType)
      : initialProgram
        ? initialProgram.activityType
        : (initialActivityType ?? 'marche'),
  )
  const [mode, setMode] = useState<'saisie' | 'direct' | 'photo'>(initialScan ? 'photo' : 'saisie')
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
      // Heure de DÉBUT (et non d'enregistrement) : sert à rapprocher la séance de celle de la montre.
      startedAt: date === todayStr() ? Date.now() - dur * 60_000 : new Date(`${date}T12:00:00`).getTime(),
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
      <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950">
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-8">
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
      </div>
    )
  }

  if (awaitingDifficulty) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950">
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-8">
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

        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Type de sortie">
          {(Object.keys(ENDURANCE_ACTIVITY_META) as EnduranceActivityType[]).map((key) => (
            <button
              key={key}
              role="radio"
              aria-checked={key === activityType}
              onClick={() => setActivityType(key)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium ${
                key === activityType ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              {ENDURANCE_ACTIVITY_META[key].label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-zinc-900 p-1" role="tablist" aria-label="Comment l'enregistrer">
          {(
            [
              ['saisie', 'Saisie', <Pencil key="i" size={14} />],
              ['direct', 'En direct', <Timer key="i" size={14} />],
              ['photo', 'Photo', <Camera key="i" size={14} />],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${
                mode === key ? 'bg-zinc-700 text-white' : 'text-zinc-400'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {mode === 'direct' && (
          <div className="mb-4">
        {gpsCapable && (
          <button
            onClick={() => {
              setSavedRoute(null)
              gps.start()
            }}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-500/10 py-3 text-sm font-semibold text-teal-400 active:bg-teal-500/20"
          >
            <MapPin size={16} /> Suivre en direct (GPS)
          </button>
        )}
        {indoorCapable && (
          <button
            onClick={() => startIndoorChrono()}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-500/10 py-3 text-sm font-semibold text-teal-400 active:bg-teal-500/20"
          >
            <Timer size={16} /> Démarrer le chrono en direct
          </button>
        )}
            {!gpsCapable && !indoorCapable && (
              <p className="mb-2 rounded-xl bg-zinc-900 p-3 text-center text-xs text-zinc-500">
                Pas de suivi en direct pour ce type — saisis la séance ou scanne l'écran de la machine.
              </p>
            )}
            <p className="text-center text-[11px] text-zinc-500">
              {gpsCapable ? 'Trace GPS, distance et allure en direct.' : 'Chrono avec relances vocales ; la difficulté ressentie est demandée à la fin.'}
            </p>
          </div>
        )}

        {mode === 'photo' && (
          <div className="mb-4">
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
          </div>
        )}

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
        {savedRoute && (
          <div className="mb-3">
            <RouteMap route={savedRoute} className="h-32 w-full" />
          </div>
        )}

        <label className="mb-1 block text-xs text-zinc-500">Durée</label>
        <div className="mb-3 flex items-center gap-1.5">
          {[15, 30, 45, 60].map((m) => (
            <button
              key={m}
              onClick={() => setDuration(String(m))}
              className={`rounded-lg px-2.5 py-2.5 text-xs font-medium ${duration === String(m) ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}
            >
              {m}
            </button>
          ))}
          <div className="relative flex-1">
            <input
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-label="Durée en minutes"
              className="w-full rounded-lg bg-zinc-900 py-2.5 pl-3 pr-10 text-center outline-none focus:ring-1 focus:ring-teal-500"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">min</span>
          </div>
        </div>

        <div className={`mb-3 grid gap-2 ${meta.hasDistance ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {meta.hasDistance && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Distance (km)</label>
              <input
                inputMode="decimal"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="optionnel"
                className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">FC moyenne (bpm)</label>
            <input
              inputMode="numeric"
              value={avgHr}
              onChange={(e) => setAvgHr(e.target.value)}
              placeholder="optionnel"
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="endurance-date" className="text-xs text-zinc-500">
            Date
          </label>
          <input
            id="endurance-date"
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">Si ta montre a déjà enregistré cette séance, les deux sont fusionnées automatiquement.</p>
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
