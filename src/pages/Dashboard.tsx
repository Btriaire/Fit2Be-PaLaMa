import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Footprints, HeartPulse, Apple, ChevronRight } from 'lucide-react'
import { getDb } from '../lib/db'
import { getAllWorkouts } from '../lib/workouts'
import { isToday, todayStr } from '../lib/date'
import { getSettings } from '../lib/settings'
import type { ActivityLog, NutritionEntry, RecoveryCheckin, Workout } from '../types'

export default function Dashboard() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [recovery, setRecovery] = useState<RecoveryCheckin | null>(null)
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([])
  const settings = getSettings()

  useEffect(() => {
    getAllWorkouts().then(setWorkouts)
    getDb().then(async (db) => {
      setActivities(await db.getAll('activities'))
      setNutrition(await db.getAll('nutrition'))
      const rec = await db.getAllFromIndex('recovery', 'byDate')
      setRecovery(rec.find((r) => r.date === todayStr()) ?? null)
    })
  }, [])

  const todayWorkouts = workouts.filter((w) => isToday(w.startedAt) && w.finishedAt)
  const todayActivityCalories = activities.filter((a) => isToday(a.loggedAt)).reduce((s, a) => s + a.caloriesBurned, 0)
  const todayNutritionCalories = nutrition.filter((n) => isToday(n.loggedAt)).reduce((s, n) => s + n.calories, 0)
  const balance = todayNutritionCalories - todayActivityCalories

  return (
    <div className="px-4 pt-6">
      <header className="mb-6">
        <p className="text-sm text-zinc-500">Aujourd'hui</p>
        <h1 className="text-2xl font-bold tracking-tight">Ton activité</h1>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <StatTile label="Séances gym" value={`${todayWorkouts.length}`} color="text-orange-400" />
        <StatTile label="Calories brûlées" value={`${todayActivityCalories}`} color="text-green-400" />
        <StatTile label="Body Battery" value={recovery ? `${recovery.bodyBatteryScore}` : '—'} color="text-purple-400" />
        <StatTile label="Balance kcal" value={`${balance >= 0 ? '+' : ''}${balance}`} color="text-sky-400" />
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
          icon={<Footprints className="text-green-400" size={20} />}
          title="Activités & Quotidien"
          subtitle="Sport outdoor, loisir, tâches"
        />
        <ModuleCard
          to="/recovery"
          icon={<HeartPulse className="text-purple-400" size={20} />}
          title="Récupération"
          subtitle="Check-in Body Battery"
        />
        <ModuleCard
          to="/nutrition"
          icon={<Apple className="text-sky-400" size={20} />}
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
