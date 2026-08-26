import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Footprints, HeartPulse, Apple, ChevronRight, Settings, Activity, BarChart3, Plus, Moon } from 'lucide-react'
import { getDb } from '../lib/db'
import { getAllWorkouts, estimateWorkoutCalories } from '../lib/workouts'
import { isToday, todayStr } from '../lib/date'
import { getSettings } from '../lib/settings'
import { syncGoogleFit, getTodayGoogleFit } from '../lib/googleFit'
import ActivityHero, { type HeroKey } from '../components/ActivityHero'
import type { ActivityLog, EnduranceSession, GoogleFitDay, NutritionEntry, RecoveryCheckin, Workout } from '../types'

export default function Dashboard() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [endurance, setEndurance] = useState<EnduranceSession[]>([])
  const [recovery, setRecovery] = useState<RecoveryCheckin | null>(null)
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([])
  const [googleFit, setGoogleFit] = useState<GoogleFitDay | null>(null)
  const settings = getSettings()

  useEffect(() => {
    getAllWorkouts().then(setWorkouts)
    getDb().then(async (db) => {
      setActivities(await db.getAll('activities'))
      setEndurance(await db.getAll('endurance'))
      setNutrition(await db.getAll('nutrition'))
      const rec = await db.getAllFromIndex('recovery', 'byDate')
      setRecovery(rec.find((r) => r.date === todayStr()) ?? null)
    })
    getTodayGoogleFit().then(setGoogleFit)
    syncGoogleFit().then(() => getTodayGoogleFit().then(setGoogleFit))
  }, [])

  const todayWorkouts = workouts.filter((w) => isToday(w.startedAt) && w.finishedAt)
  const todayGymCalories = todayWorkouts.reduce((s, w) => s + estimateWorkoutCalories(w, settings), 0)
  const todayActivityCalories = activities.filter((a) => isToday(a.loggedAt)).reduce((s, a) => s + a.caloriesBurned, 0)
  const todayEnduranceCalories = endurance.filter((e) => isToday(e.startedAt)).reduce((s, e) => s + e.caloriesBurned, 0)
  const todayBurnedCalories = todayGymCalories + todayActivityCalories + todayEnduranceCalories
  const todayNutritionCalories = nutrition.filter((n) => isToday(n.loggedAt)).reduce((s, n) => s + n.calories, 0)
  const balance = todayNutritionCalories - todayBurnedCalories

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="course" className="h-48" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <div>
            <p className="text-sm text-zinc-300 drop-shadow">Aujourd'hui</p>
            <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow">Ton activité</h1>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/stats" className="rounded-full bg-zinc-950/40 p-2 text-white active:bg-zinc-900">
              <BarChart3 size={20} />
            </Link>
            <Link to="/settings" className="rounded-full bg-zinc-950/40 p-2 text-white active:bg-zinc-900">
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

      <div className="mb-6 grid grid-cols-2 gap-2">
        <StatTile label="Séances gym" value={`${todayWorkouts.length}`} color="text-orange-400" />
        <StatTile label="Calories brûlées" value={`${todayBurnedCalories}`} color="text-teal-400" />
        <StatTile label="Body Battery" value={recovery ? `${recovery.bodyBatteryScore}` : '—'} color="text-indigo-400" />
        <StatTile label="Balance kcal" value={`${balance >= 0 ? '+' : ''}${balance}`} color="text-teal-400" />
      </div>

      {googleFit && (
        <div className="mb-6 grid grid-cols-2 gap-2">
          <StatTile
            icon={<Footprints size={14} className="text-teal-400" />}
            label="Pas (Google Fit)"
            value={googleFit.steps.toLocaleString('fr-FR')}
            color="text-teal-400"
          />
          <StatTile
            icon={<Moon size={14} className="text-indigo-400" />}
            label="Sommeil (Google Fit)"
            value={googleFit.sleepMinutes != null ? `${Math.floor(googleFit.sleepMinutes / 60)}h${String(googleFit.sleepMinutes % 60).padStart(2, '0')}` : '—'}
            color="text-indigo-400"
          />
        </div>
      )}

      <Link
        to="/add"
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-teal-500 py-3.5 text-sm font-semibold text-zinc-950 active:scale-[0.98] transition-transform"
      >
        <Plus size={18} strokeWidth={2.5} /> Ajouter
      </Link>

      <div className="space-y-2.5">
        <ModuleCard
          to="/gym"
          heroKey="gym"
          icon={<Dumbbell className="text-orange-400" size={20} />}
          title="Gym & Fitness"
          subtitle="Lancer une séance, voir l'historique"
        />
        <ModuleCard
          to="/activities"
          heroKey="marche"
          icon={<Footprints className="text-teal-400" size={20} />}
          title="Activités & Quotidien"
          subtitle="Sport outdoor, loisir, tâches"
        />
        <ModuleCard
          to="/endurance"
          heroKey="velo"
          icon={<Activity className="text-teal-400" size={20} />}
          title="Endurance"
          subtitle="Course, vélo, natation, zones FC"
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
          title="NutriTracker"
          subtitle={`Objectif ${settings.dailyCalorieTarget} kcal/jour`}
        />
      </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <p className="flex items-center gap-1 text-xs text-zinc-500">
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
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
