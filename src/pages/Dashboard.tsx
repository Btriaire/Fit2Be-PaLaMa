import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Apple, Camera, ChevronLeft, ChevronRight, Dumbbell, Flame, Footprints, HeartPulse, ImagePlus, Loader2, Moon, Plus, RefreshCw, Sparkles, Timer, TrendingUp, User } from 'lucide-react'
import { getDb } from '../lib/db'
import { getAllWorkouts, estimateWorkoutCalories } from '../lib/workouts'
import { isSameDay, todayStr, addDays, formatFullDate } from '../lib/date'
import { getSettings } from '../lib/settings'
import { syncGoogleFit, getGoogleFitForDate } from '../lib/googleFit'
import { onFitRefreshed, refreshFitData } from '../lib/fitSync'
import { syncLatestWeightFromNutriTracker } from '../lib/weight'
import { scanMachineResults } from '../lib/machineScan'
import { getDailyPhoto, saveDailyPhoto } from '../lib/dailyPhoto'
import { compressImageToDataUrl } from '../lib/image'
import { pullMoodOfTheDay, type RemoteMood } from '../lib/nutriTrackerSync'
import { getQuoteOfTheDay } from '../lib/motivation'
import { computeActivityStreak, computeDailyRecovery, type ActivityStreak, type DailyRecovery } from '../lib/recovery'
import { ENDURANCE_ACTIVITY_META } from '../lib/endurance'
import ActivityRing from '../components/ActivityRing'
import SyncStatusLine from '../components/SyncStatusLine'
import FitStatusLine from '../components/FitStatusLine'
import DailyCheckinCard from '../components/DailyCheckinCard'
import { isHighFatigueCheckin, type CheckinDraft } from '../lib/checkin'
import { effectiveSleepMinutes } from '../lib/fitHealth'
import { computePersonalGoals, DEFAULT_SESSIONS_GOAL, DEFAULT_STEPS_GOAL, type PersonalGoals } from '../lib/personalGoals'
import { computeTrainingAlerts, type TrainingAlert } from '../lib/trainingAlerts'
import { mostNeglected, weeklyVolumeByGroup } from '../lib/weeklyVolume'
import { getMuscleGroupVolume } from '../lib/workouts'
import { effectiveCalorieTarget } from '../lib/calorieTarget'
import ActivityHero, { type HeroKey } from '../components/ActivityHero'
import type { ActivityLog, DailyPhoto, EnduranceSession, GoogleFitDay, NutritionEntry, RecoveryCheckin, Workout } from '../types'

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' }

export default function Dashboard() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [endurance, setEndurance] = useState<EnduranceSession[]>([])
  const [recovery, setRecovery] = useState<RecoveryCheckin | null>(null)
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([])
  const [googleFit, setGoogleFit] = useState<GoogleFitDay | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [dailyPhoto, setDailyPhoto] = useState<DailyPhoto | null>(null)
  const [photoSaving, setPhotoSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [mood, setMood] = useState<RemoteMood | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [streak, setStreak] = useState<ActivityStreak | null>(null)
  const [load, setLoad] = useState<DailyRecovery | null>(null)
  const [alerts, setAlerts] = useState<TrainingAlert[]>([])
  const [goals, setGoals] = useState<PersonalGoals>({ steps: DEFAULT_STEPS_GOAL, sessions: DEFAULT_SESSIONS_GOAL, adapted: false })
  const [neglected, setNeglected] = useState<string[]>([])
  const [checkinDraft, setCheckinDraft] = useState<CheckinDraft | null>(null)
  const settings = getSettings()
  const quote = getQuoteOfTheDay()

  async function refreshLocalState(date: string) {
    getAllWorkouts().then(setWorkouts)
    getDb().then(async (db) => {
      setActivities(await db.getAll('activities'))
      setEndurance(await db.getAll('endurance'))
      setNutrition(await db.getAll('nutrition'))
      const rec = await db.getAllFromIndex('recovery', 'byDate')
      setRecovery(rec.find((r) => r.date === date) ?? null)
    })
    await getGoogleFitForDate(date).then(setGoogleFit)
    await pullMoodOfTheDay(date).then(setMood)
    await getDailyPhoto(date).then(setDailyPhoto)
  }

  async function forceSyncNow() {
    setSyncing(true)
    try {
      await Promise.all([refreshFitData(settings, { force: true }).catch(() => null), syncLatestWeightFromNutriTracker()])
      await refreshLocalState(selectedDate)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDailyPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoSaving(true)
    try {
      const dataUrl = await compressImageToDataUrl(file)
      setDailyPhoto(await saveDailyPhoto(dataUrl))
    } finally {
      setPhotoSaving(false)
    }
  }

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setScanning(true)
    setScanError(null)
    try {
      const result = await scanMachineResults(files)
      navigate('/endurance', { state: { openForm: true, scanResult: result } })
    } catch (err) {
      const detail = err instanceof Error ? err.message : ''
      setScanError(`Impossible de lire ${files.length > 1 ? 'ces photos' : 'cette photo'}${detail ? ` (${detail})` : ''}.`)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    computeActivityStreak(settings.ageYears).then(setStreak)
    computeDailyRecovery(settings.ageYears).then(setLoad)
    computeTrainingAlerts(settings.ageYears).then(setAlerts)
    computePersonalGoals().then(setGoals)
    getMuscleGroupVolume(7).then((stats) => setNeglected(mostNeglected(weeklyVolumeByGroup(stats), 2).map((g) => g.label)))
  }, [workouts, activities, endurance, settings.ageYears])

  useEffect(() => {
    refreshLocalState(selectedDate)
    if (selectedDate === todayStr()) syncGoogleFit().then(() => refreshLocalState(selectedDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // La synchro montre (import, fusion des doublons, pas du jour) tourne en fond : on
  // recharge quand elle se termine pour afficher les vrais chiffres.
  useEffect(() => onFitRefreshed(() => void refreshLocalState(selectedDate)), [selectedDate])

  const todayWorkouts = workouts.filter((w) => isSameDay(w.startedAt, selectedDate) && w.finishedAt)
  const todayGymCalories = todayWorkouts.reduce((s, w) => s + estimateWorkoutCalories(w, settings), 0)
  const todayActivityCalories = activities.filter((a) => isSameDay(a.loggedAt, selectedDate)).reduce((s, a) => s + a.caloriesBurned, 0)
  const todayEnduranceCalories = endurance.filter((e) => isSameDay(e.startedAt, selectedDate)).reduce((s, e) => s + e.caloriesBurned, 0)
  const todayBurnedCalories = todayGymCalories + todayActivityCalories + todayEnduranceCalories
  const todayNutritionCalories = nutrition.filter((n) => isSameDay(n.loggedAt, selectedDate)).reduce((s, n) => s + n.calories, 0)

  const isToday = selectedDate === todayStr()
  const stepsToday = googleFit?.steps ?? null
  // Une durée corrigée à la main dans le check-in prime sur Google Fit.
  const sleepMin =
    isToday && checkinDraft?.sleepSource === 'manual' ? Math.round(checkinDraft.sleepHours * 60) : effectiveSleepMinutes(googleFit, recovery?.sleepHours)

  const windowEnd = new Date(`${selectedDate}T23:59:59`).getTime()
  const windowStart = windowEnd - 7 * 86_400_000
  const weeklySessions =
    workouts.filter((w) => w.finishedAt && w.startedAt >= windowStart && w.startedAt <= windowEnd).length +
    endurance.filter((e) => !e.id.startsWith('steps-') && e.startedAt >= windowStart && e.startedAt <= windowEnd).length
  const sessionsToday =
    todayWorkouts.length + endurance.filter((e) => !e.id.startsWith('steps-') && isSameDay(e.startedAt, selectedDate)).length

  const lastSession = latestSession(workouts, endurance, activities)
  const suggestion = isToday
    ? nextAction({ sleepMin, load, sessionsToday, eaten: todayNutritionCalories, alerts, neglected, checkin: checkinDraft })
    : null

  // Même logique que la page Diet : la cible de base + les calories brûlées du jour.
  const calorieTarget = effectiveCalorieTarget(settings).target
  const remaining = calorieTarget + todayBurnedCalories - todayNutritionCalories

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="course" className="h-36" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
          <div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                className="-my-2.5 flex h-11 w-8 items-center justify-center rounded-full text-zinc-300 drop-shadow active:bg-zinc-950/40"
                aria-label="Jour précédent"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm capitalize text-zinc-200 drop-shadow">{isToday ? "Aujourd'hui" : formatFullDate(selectedDate)}</p>
              <button
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                disabled={selectedDate >= todayStr()}
                className="-my-2.5 flex h-11 w-8 items-center justify-center rounded-full text-zinc-300 drop-shadow active:bg-zinc-950/40 disabled:opacity-30"
                aria-label="Jour suivant"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow">Ton activité</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {isToday && streak && streak.activeDaysStreak > 0 && (
              <div
                className="flex items-center gap-1 rounded-full bg-zinc-950/55 px-2.5 py-1.5 text-sm font-bold text-orange-300 backdrop-blur"
                aria-label={`${streak.activeDaysStreak} jours actifs d'affilée`}
              >
                <Flame size={16} className="fill-orange-400 text-orange-400" />
                {streak.activeDaysStreak}
              </div>
            )}
            <button
              onClick={forceSyncNow}
              disabled={syncing}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950/40 text-white active:bg-zinc-900 disabled:opacity-60"
              aria-label="Forcer la synchro NutriTracker et Google Fit"
            >
              <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
            </button>
            {/* "Moi" — point d'entrée unique et reconnaissable vers le profil/réglages,
                façon avatar NutriTracker : la photo si elle existe, sinon l'initiale
                sur fond de couleur, plutôt qu'une icône engrenage abstraite. */}
            <Link
              to="/settings"
              aria-label="Moi"
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-zinc-950/40 text-white ring-1 ring-white/10 active:bg-zinc-900"
            >
              {settings.profilePhotoDataUrl ? (
                <img src={settings.profilePhotoDataUrl} alt="" className="h-full w-full object-cover" />
              ) : settings.firstName ? (
                <span className="flex h-full w-full items-center justify-center bg-orange-500/30 text-sm font-bold text-orange-200">
                  {settings.firstName[0].toUpperCase()}
                </span>
              ) : (
                <User size={20} />
              )}
            </Link>
          </div>
        </div>
      </div>

      <div className="-mt-3 space-y-3 px-4 pb-6">
        {scanError && <p className="text-center text-xs text-red-400">{scanError}</p>}

        {isToday && <FitStatusLine refreshKey={googleFit?.syncedAt ?? 0} />}
        {isToday && (
          <DailyCheckinCard
            onChange={(draft, saved) => {
              setCheckinDraft(draft)
              if (saved) setRecovery(saved)
            }}
          />
        )}

        <section className="glass rounded-3xl p-4" aria-label="Objectifs du jour">
          <div className="flex items-start justify-between gap-2">
            <ActivityRing
              icon={<Footprints size={24} />}
              label="Pas"
              display={stepsToday != null ? stepsToday.toLocaleString('fr-FR') : '—'}
              goalLabel={`/ ${goals.steps.toLocaleString('fr-FR')}`}
              value={stepsToday}
              goal={goals.steps}
              color="#4a63d8"
            />
            <ActivityRing
              icon={<Dumbbell size={24} />}
              label="Séances 7 j"
              display={`${weeklySessions}`}
              goalLabel={`/ ${goals.sessions}`}
              value={weeklySessions}
              goal={goals.sessions}
              color="#ff5a30"
            />
            <ActivityRing
              icon={<Moon size={24} />}
              label="Sommeil"
              display={sleepMin != null ? `${Math.floor(sleepMin / 60)}h${String(sleepMin % 60).padStart(2, '0')}` : '—'}
              goalLabel={`/ ${Math.floor(settings.sleepTargetMin / 60)}h`}
              value={sleepMin}
              goal={settings.sleepTargetMin}
              color="#818cf8"
            />
          </div>

          {goals.adapted && <p className="mt-2 text-center text-[11px] text-zinc-400">Objectifs adaptés à tes dernières semaines</p>}

          <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-800 border-t border-zinc-800 pt-3 text-center">
            <div>
              <p className="text-base font-bold text-zinc-50">{todayBurnedCalories}</p>
              <p className="text-[11px] text-zinc-500">kcal brûlées</p>
            </div>
            <div>
              <p className="text-base font-bold text-zinc-50">
                {todayNutritionCalories}
                <span className="text-xs font-medium text-zinc-400"> / {calorieTarget + todayBurnedCalories}</span>
              </p>
              <p className="text-[11px] text-zinc-500">kcal mangées</p>
            </div>
            <div>
              <p className={`text-base font-bold ${remaining >= 0 ? 'text-teal-300' : 'text-orange-400'}`}>{Math.abs(remaining)}</p>
              <p className="text-[11px] text-zinc-500">{remaining >= 0 ? 'kcal restantes' : 'au-dessus'}</p>
            </div>
          </div>

          {(recovery || mood?.mood != null) && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
              {recovery && (
                <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-indigo-300">Body Battery {recovery.bodyBatteryScore}</span>
              )}
              {mood?.mood != null && (
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-300">
                  Humeur {MOOD_EMOJI[mood.mood] ?? '😐'} {mood.mood}/5
                </span>
              )}
            </div>
          )}
        </section>

        {suggestion && (
          <Link
            to={suggestion.to}
            className="glass flex items-center gap-3 rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/12 to-transparent p-3.5 active:scale-[0.99] transition-transform"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-300">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-orange-300/80">Pour aujourd&apos;hui</p>
              <p className="text-sm font-semibold text-zinc-50">{suggestion.title}</p>
              <p className="text-xs text-zinc-400">{suggestion.detail}</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-zinc-500" />
          </Link>
        )}

        {lastSession && (
          <div className="glass rounded-2xl p-3.5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Dernière activité</p>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300">
                {lastSession.kind === 'gym' ? <Dumbbell size={20} /> : <Activity size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{lastSession.label}</p>
                <p className="text-xs text-zinc-500">
                  {relativeDay(lastSession.at)} · {lastSession.durationMin} min · {lastSession.kcal} kcal
                </p>
              </div>
            </div>
            {isToday && load && load.totalLoad > 0 && <p className="mt-2.5 border-t border-zinc-800 pt-2.5 text-xs text-zinc-400">{load.hint}</p>}
          </div>
        )}

        <input ref={scanInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScanFile} />
        <input ref={photoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleDailyPhoto} />

        <div className="grid grid-cols-2 gap-2.5">
          <BigModuleCard to="/gym" heroKey="gym" icon={<Dumbbell size={22} />} title="Fitness" color="text-orange-400" />
          <BigModuleCard to="/endurance" heroKey="velo" icon={<Activity size={22} />} title="Activité" color="text-teal-300" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ShortcutTile to="/recovery" icon={<HeartPulse size={20} />} label="Récup" color="text-indigo-300" />
          <ShortcutTile to="/nutrition" icon={<Apple size={20} />} label="Diet" color="text-orange-300" />
          <ShortcutTile to="/progression" icon={<TrendingUp size={20} />} label="Progrès" color="text-indigo-300" />
          <ShortcutTile to="/timer" icon={<Timer size={20} />} label="Chrono" color="text-zinc-200" />
          <ShortcutTile
            onClick={() => scanInputRef.current?.click()}
            icon={scanning ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            label="Scan machine"
            color="text-zinc-200"
            disabled={scanning}
          />
          {dailyPhoto ? (
            <Link to="/photos" className="glass relative flex h-[68px] items-end overflow-hidden rounded-2xl active:scale-95 transition-transform" aria-label="Photo du jour">
              <img src={dailyPhoto.dataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="relative w-full bg-gradient-to-t from-black/80 to-transparent px-1 pb-1 pt-4 text-center text-[10px] font-medium text-white">Photo du jour</span>
            </Link>
          ) : (
            <ShortcutTile
              onClick={() => (isToday ? photoInputRef.current?.click() : navigate('/photos'))}
              icon={photoSaving ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
              label="Photo du jour"
              color="text-zinc-200"
              disabled={photoSaving}
            />
          )}
        </div>

        <SyncStatusLine className="pt-1" />

        <p className="px-2 pt-1 text-center text-xs italic leading-snug text-zinc-500">
          « {quote.text} » — {quote.author}
        </p>
      </div>

      <Link
        to="/add"
        aria-label="Ajouter"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-400 text-zinc-950 shadow-lg shadow-orange-500/40 active:scale-95 transition-transform"
      >
        <Plus size={26} strokeWidth={2.5} />
      </Link>
    </div>
  )
}

interface Suggestion {
  to: string
  title: string
  detail: string
}

function nextAction(ctx: {
  sleepMin: number | null
  load: DailyRecovery | null
  sessionsToday: number
  eaten: number
  alerts: TrainingAlert[]
  neglected: string[]
  checkin: Pick<CheckinDraft, 'generalFatigue' | 'muscleFatigue'> | null
}): Suggestion {
  if (ctx.sleepMin != null && ctx.sleepMin < 360)
    return { to: '/recovery', title: 'Nuit courte — vas-y en douceur', detail: 'Moins de 6 h de sommeil : privilégie une séance légère ou de la récupération.' }
  if (ctx.load && (ctx.load.band === 'importante' || ctx.load.band === 'intense'))
    return { to: '/recovery', title: 'Grosse charge aujourd’hui', detail: 'Étirements, marche ou repos : laisse le corps encaisser.' }
  if (isHighFatigueCheckin(ctx.checkin))
    return { to: '/recovery', title: 'Tu te sens fatigué — allège', detail: 'Fatigue élevée déclarée : privilégie une séance légère, des étirements ou du repos.' }
  const deload = ctx.alerts.find((a) => a.level === 'warn')
  if (deload) return { to: deload.to, title: deload.title, detail: deload.detail }
  if (ctx.sessionsToday === 0)
    return {
      to: '/gym',
      title: 'Lance une séance',
      detail: ctx.neglected.length ? `Cette semaine il te manque du volume : ${ctx.neglected.join(', ').toLowerCase()}.` : 'Aucune séance aujourd’hui — choisis un programme ou une séance libre.',
    }
  if (ctx.eaten === 0) return { to: '/nutrition', title: 'Note ton premier repas', detail: 'Sans repas saisi, ton suivi calorique du jour reste vide.' }
  return { to: '/progression', title: 'Journée en bonne voie', detail: 'Objectifs cochés — regarde ta progression.' }
}

function latestSession(workouts: Workout[], endurance: EnduranceSession[], activities: ActivityLog[]) {
  const items: { kind: 'gym' | 'other'; at: number; label: string; durationMin: number; kcal: number }[] = []
  for (const w of workouts) {
    if (!w.finishedAt) continue
    items.push({ kind: 'gym', at: w.startedAt, label: w.name, durationMin: Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60000)), kcal: 0 })
  }
  for (const e of endurance) {
    if (e.id.startsWith('steps-')) continue
    items.push({ kind: 'other', at: e.startedAt, label: ENDURANCE_ACTIVITY_META[e.activityType].label, durationMin: e.durationMin, kcal: e.caloriesBurned })
  }
  for (const a of activities) items.push({ kind: 'other', at: a.loggedAt, label: a.label, durationMin: a.durationMin, kcal: a.caloriesBurned })
  items.sort((a, b) => b.at - a.at)
  const top = items[0]
  if (!top) return null
  if (top.kind === 'gym') {
    const w = workouts.find((x) => x.startedAt === top.at)
    if (w) top.kcal = estimateWorkoutCalories(w, getSettings())
  }
  return top
}

function relativeDay(ts: number): string {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

function ShortcutTile({
  to,
  onClick,
  icon,
  label,
  color,
  disabled,
}: {
  to?: string
  onClick?: () => void
  icon: React.ReactNode
  label: string
  color: string
  disabled?: boolean
}) {
  const cls = 'glass flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl active:scale-95 transition-transform disabled:opacity-60'
  const inner = (
    <>
      <span className={color}>{icon}</span>
      <span className="text-[10px] font-medium leading-none text-zinc-400">{label}</span>
    </>
  )
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  )
}

function BigModuleCard({
  to,
  heroKey,
  icon,
  title,
  color,
}: {
  to: string
  heroKey: HeroKey
  icon: React.ReactNode
  title: string
  color: string
}) {
  return (
    <Link to={to} className="glass relative block h-24 overflow-hidden rounded-2xl active:scale-[0.98] transition-transform">
      <ActivityHero heroKey={heroKey} className="h-24" />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
        <span className={color}>{icon}</span>
        <p className="text-base font-bold text-white drop-shadow">{title}</p>
      </div>
    </Link>
  )
}
