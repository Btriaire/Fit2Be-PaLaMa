import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Footprints, HeartPulse, Apple, ChevronRight, Settings, Activity, BarChart3 } from 'lucide-react'
import { getDb } from '../lib/db'
import { getAllWorkouts, estimateWorkoutCalories } from '../lib/workouts'
import { isToday, todayStr } from '../lib/date'
import { getSettings } from '../lib/settings'
import type { ActivityLog, EnduranceSession, NutritionEntry, RecoveryCheckin, Workout } from '../types'

export default function Dashboard() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [endurance, setEndurance] = useState<EnduranceSession[]>([])
  const [recovery, setRecovery] = useState<RecoveryCheckin | null>(null)
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([])
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
  }, [])

  const todayWorkouts = workouts.filter((w) => isToday(w.startedAt) && w.finishedAt)
  const todayGymCalories = todayWorkouts.reduce((s, w) => s + estimateWorkoutCalories(w, settings), 0)
  const todayActivityCalories = activities.filter((a) => isToday(a.loggedAt)).reduce((s, a) => s + a.caloriesBurned, 0)
  const todayEnduranceCalories = endurance.filter((e) => isToday(e.startedAt)).reduce((s, e) => s + e.caloriesBurned, 0)
  const todayBurnedCalories = todayGymCalories + todayActivityCalories + todayEnduranceCalories
  const todayNutritionCalories = nutrition.filter((n) => isToday(n.loggedAt)).reduce((s, n) => s + n.calories, 0)
  const balance = todayNutritionCalories - todayBurnedCalories

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">Aujourd'hui</p>
          <h1 className="text-2xl font-bold tracking-tight">Ton activité</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/stats" className="rounded-full p-2 text-zinc-500 active:bg-zinc-900">
            <BarChart3 size={20} />
          </Link>
          <Link to="/settings" className="rounded-full p-2 text-zinc-500 active:bg-zinc-900">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <StatTile label="Séances gym" value={`${todayWorkouts.length}`} color="text-orange-400" />
        <StatTile label="Calories brûlées" value={`${todayBurnedCalories}`} color="text-teal-400" />
        <StatTile label="Body Battery" value={recovery ? `${recovery.bodyBatteryScore}` : '—'} color="text-indigo-400" />
        <StatTile label="Balance kcal" value={`${balance >= 0 ? '+' : ''}${balance}`} color="text-teal-400" />
      </div>

      <div className="space-y-2.5">
        <ModuleCard
          to="/gym"
          icon={<Dumbbell className="text-orange-400" size={20} />}
          title="Gym & Fitness"
          subtitle="Lancer une séance, voir l'historique"
        />
        <ModuleCard
          to="/activities"
          icon={<Footprints className="text-teal-400" size={20} />}
          title="Activités & Quotidien"
          subtitle="Sport outdoor, loisir, tâches"
        />
        <ModuleCard
          to="/endurance"
          icon={<Activity className="text-teal-400" size={20} />}
          title="Endurance"
          subtitle="Course, vélo, natation, zones FC"
        />
        <ModuleCard
          to="/recovery"
          icon={<HeartPulse className="text-indigo-400" size={20} />}
          title="Récupération"
          subtitle="Check-in Body Battery"
        />
        <ModuleCard
          to="/nutrition"
          icon={<Apple className="text-teal-400" size={20} />}
          title="NutriTracker"
          subtitle={`Objectif ${settings.dailyCalorieTarget} kcal/jour`}
        />
      </div>
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ModuleCard({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link to={to} className="glass flex items-center gap-3 rounded-2xl p-4 active:bg-zinc-900/80">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900">{icon}</div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      <ChevronRight className="text-zinc-600" size={18} />
    </Link>
  )
}
