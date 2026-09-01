import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Dumbbell, Footprints, HeartPulse, Apple, Camera, ChevronLeft, ChevronRight, Settings, Activity, BarChart3, Loader2, Plus, Moon, TrendingUp, ImagePlus, RefreshCw } from 'lucide-react'
import { getDb } from '../lib/db'
import { getAllWorkouts, estimateWorkoutCalories } from '../lib/workouts'
import { isSameDay, todayStr, addDays, formatFullDate } from '../lib/date'
import { getSettings } from '../lib/settings'
import { syncGoogleFit, getGoogleFitForDate } from '../lib/googleFit'
import { autoLogWalkFromStepsIfNeeded } from '../lib/stepsActivity'
import { importNutriTrackerActivityHistory } from '../lib/nutriTrackerImport'
import { syncLatestWeightFromNutriTracker } from '../lib/weight'
import { scanMachineResults } from '../lib/machineScan'
import { getDailyPhoto, saveDailyPhoto } from '../lib/dailyPhoto'
import { compressImageToDataUrl } from '../lib/image'
import { pullMoodOfTheDay, type RemoteMood } from '../lib/nutriTrackerSync'
import { getQuoteOfTheDay } from '../lib/motivation'
import { Quote } from 'lucide-react'
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
      await Promise.all([
        syncGoogleFit().then(() => autoLogWalkFromStepsIfNeeded(settings)),
        importNutriTrackerActivityHistory(30, settings),
        syncLatestWeightFromNutriTracker(),
      ])
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
    refreshLocalState(selectedDate)
    if (selectedDate === todayStr()) syncGoogleFit().then(() => refreshLocalState(selectedDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const todayWorkouts = workouts.filter((w) => isSameDay(w.startedAt, selectedDate) && w.finishedAt)
  const todayGymCalories = todayWorkouts.reduce((s, w) => s + estimateWorkoutCalories(w, settings), 0)
  const todayActivityCalories = activities.filter((a) => isSameDay(a.loggedAt, selectedDate)).reduce((s, a) => s + a.caloriesBurned, 0)
  const todayEnduranceCalories = endurance.filter((e) => isSameDay(e.startedAt, selectedDate)).reduce((s, e) => s + e.caloriesBurned, 0)
  const todayBurnedCalories = todayGymCalories + todayActivityCalories + todayEnduranceCalories
  const todayNutritionCalories = nutrition.filter((n) => isSameDay(n.loggedAt, selectedDate)).reduce((s, n) => s + n.calories, 0)
  const balance = todayNutritionCalories - todayBurnedCalories

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="course" className="h-48" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                className="rounded-full p-0.5 text-zinc-300 drop-shadow active:bg-zinc-950/40"
                aria-label="Jour précédent"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm capitalize text-zinc-300 drop-shadow">{formatFullDate(selectedDate)}</p>
              <button
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                disabled={selectedDate >= todayStr()}
                className="rounded-full p-0.5 text-zinc-300 drop-shadow active:bg-zinc-950/40 disabled:opacity-30"
                aria-label="Jour suivant"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow">Ton activité</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={forceSyncNow}
              disabled={syncing}
              className="rounded-full bg-zinc-950/40 p-2 text-white active:bg-zinc-900 disabled:opacity-60"
              aria-label="Forcer la synchro NutriTracker et Google Fit"
            >
              <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
            </button>
            <input ref={scanInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScanFile} />
            <button
              onClick={() => scanInputRef.current?.click()}
              disabled={scanning}
              className="rounded-full bg-zinc-950/40 p-2 text-white active:bg-zinc-900 disabled:opacity-60"
              aria-label="Scanner un résultat machine"
            >
              {scanning ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            </button>
            <Link to="/progression" className="rounded-full bg-zinc-950/40 p-2 text-white active:bg-zinc-900">
              <BarChart3 size={20} />
            </Link>
            <Link to="/settings" className="rounded-full bg-zinc-950/40 p-2 text-white active:bg-zinc-900">
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

      {scanError && <p className="mb-4 text-center text-xs text-red-400">{scanError}</p>}

      <div className="mb-4 grid grid-cols-2 gap-1.5">
        <StatTile label="Séances gym" value={`${todayWorkouts.length}`} color="text-orange-400" />
        <StatTile label="Calories brûlées" value={`${todayBurnedCalories}`} color="text-teal-400" />
        <StatTile label="Body Battery" value={recovery ? `${recovery.bodyBatteryScore}` : '—'} color="text-indigo-400" />
        <StatTile label="Balance kcal" value={`${balance >= 0 ? '+' : ''}${balance}`} color="text-teal-400" />
      </div>

      <div className="glass mb-4 rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent p-4">
        <div className="flex items-start gap-2.5">
          <Quote size={18} className="mt-0.5 shrink-0 text-orange-400" />
          <div>
            <p className="text-sm italic leading-snug text-zinc-200">{quote.text}</p>
            <p className="mt-1.5 text-xs text-zinc-500">— {quote.author}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1.5">
        {googleFit && (
          <>
            <StatTile
              icon={<Footprints size={12} className="text-teal-400" />}
              label="Pas (Google Fit)"
              value={googleFit.steps.toLocaleString('fr-FR')}
              color="text-teal-400"
            />
            <StatTile
              icon={<Moon size={12} className="text-indigo-400" />}
              label="Sommeil (Google Fit)"
              value={googleFit.sleepMinutes != null ? `${Math.floor(googleFit.sleepMinutes / 60)}h${String(googleFit.sleepMinutes % 60).padStart(2, '0')}` : '—'}
              color="text-indigo-400"
            />
          </>
        )}
        <StatTile
          label="Humeur du jour"
          value={mood?.mood != null ? `${MOOD_EMOJI[mood.mood] ?? '😐'} ${mood.mood}/5` : '—'}
          color="text-indigo-300"
        />
      </div>

      <div className="glass mb-6 flex items-center gap-3 rounded-2xl p-3.5">
        <input ref={photoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleDailyPhoto} />
        <Link to="/photos" className="flex flex-1 items-center gap-3">
          {dailyPhoto ? (
            <img src={dailyPhoto.dataUrl} alt="Photo du jour" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600">
              <ImagePlus size={22} />
            </div>
          )}
          <div className="flex-1">
            <p className="font-semibold">Photo du jour</p>
            <p className="text-xs text-zinc-500">
              {dailyPhoto ? `Prise le ${formatFullDate(selectedDate).toLowerCase()} · voir l'historique` : `Aucune photo pour ${selectedDate === todayStr() ? "aujourd'hui" : 'ce jour-là'}`}
            </p>
          </div>
        </Link>
        {selectedDate === todayStr() && (
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={photoSaving}
            className="rounded-full bg-zinc-800 p-2.5 active:bg-zinc-700 disabled:opacity-60"
            aria-label="Prendre ou choisir une photo"
          >
            {photoSaving ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </button>
        )}
      </div>

      <Link
        to="/add"
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-teal-500 py-3.5 text-sm font-semibold text-zinc-950 active:scale-[0.98] transition-transform"
      >
        <Plus size={18} strokeWidth={2.5} /> Ajouter
      </Link>

      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        <BigModuleCard to="/gym" heroKey="gym" icon={<Dumbbell size={26} />} title="Fitness" color="text-orange-400" />
        <BigModuleCard to="/endurance" heroKey="velo" icon={<Activity size={26} />} title="Endurance" color="text-teal-400" />
      </div>

      <div className="space-y-2.5">
        <ModuleCard
          to="/progression"
          heroKey="course"
          icon={<TrendingUp className="text-indigo-300" size={20} />}
          title="Progression"
          subtitle="Index général, musculaire et cardiaque"
        />
        <ModuleCard
          to="/activities"
          heroKey="marche"
          icon={<Footprints className="text-teal-400" size={20} />}
          title="Activités & Quotidien"
          subtitle="Sport outdoor, loisir, tâches"
        />
        <ModuleCard
          to="/recovery"
          heroKey="yoga"
          icon={<HeartPulse className="text-indigo-400" size={20} />}
          title="Récupération"
          subtitle="Check-in Body Battery"
        />
        <ModuleCard
          to="/nutrition"
          heroKey="food"
          icon={<Apple className="text-teal-400" size={20} />}
          title="Diet Deficit"
          subtitle={`Objectif ${settings.dailyCalorieTarget} kcal/jour`}
        />
      </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="glass flex items-center justify-between gap-2 rounded-xl px-2.5 py-2">
      <p className="flex items-center gap-1 text-[11px] text-zinc-500">
        {icon}
        {label}
      </p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
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
    <Link to={to} className="glass relative block h-32 overflow-hidden rounded-2xl active:scale-[0.98] transition-transform">
      <ActivityHero heroKey={heroKey} className="h-32" />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
        <span className={color}>{icon}</span>
        <p className="text-base font-bold text-white drop-shadow">{title}</p>
      </div>
    </Link>
  )
}

function ModuleCard({
  to,
  heroKey,
  icon,
  title,
  subtitle,
}: {
  to: string
  heroKey: HeroKey
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link to={to} className="glass flex items-center gap-3 rounded-2xl p-2.5 pr-4 active:bg-zinc-900/80">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <ActivityHero heroKey={heroKey} className="h-14 w-14" />
        <div className="absolute inset-0 flex items-center justify-center">{icon}</div>
      </div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      <ChevronRight className="text-zinc-600" size={18} />
    </Link>
  )
}
