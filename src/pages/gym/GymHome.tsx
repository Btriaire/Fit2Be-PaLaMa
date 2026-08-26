import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, ChevronRight, Flame, TrendingUp, Trash2 } from 'lucide-react'
import { getAllWorkouts, saveWorkout, deleteWorkout, getLoggedExerciseIds } from '../../lib/workouts'
import { newId } from '../../lib/db'
import { formatDate, formatTime } from '../../lib/date'
import { ALL_EXERCISES } from '../../lib/exercises'
import ActivityHero from '../../components/ActivityHero'
import type { Workout } from '../../types'

const QUICK_NAMES = ['Push Day', 'Pull Day', 'Leg Day', 'Full Body', 'Haut du corps', 'Bas du corps']

export default function GymHome() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedExercises, setLoggedExercises] = useState<Array<{ exerciseId: string; lastDate: number }>>([])

  useEffect(() => {
    getAllWorkouts().then((w) => {
      setWorkouts(w)
      setLoading(false)
    })
    getLoggedExerciseIds().then(setLoggedExercises)
  }, [])

  async function startWorkout(name: string) {
    const workout: Workout = {
      id: newId(),
      name,
      startedAt: Date.now(),
      exercises: [],
    }
    await saveWorkout(workout)
    navigate(`/gym/workout/${workout.id}`)
  }

  const inProgress = workouts.find((w) => !w.finishedAt)

  async function removeWorkout(id: string, name: string) {
    if (!confirm(`Supprimer la séance "${name}" ?`)) return
    await deleteWorkout(id)
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="gym" className="h-40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <Dumbbell className="text-orange-400" size={24} />
          <h1 className="text-xl font-semibold tracking-tight text-white drop-shadow">Gym & Fitness</h1>
        </div>
      </div>

      <div className="px-4 pt-4">

      {inProgress && (
        <button
          onClick={() => navigate(`/gym/workout/${inProgress.id}`)}
          className="mb-4 w-full rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4 text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-orange-400">Séance en cours</p>
              <p className="mt-0.5 font-semibold">{inProgress.name}</p>
            </div>
            <ChevronRight className="text-orange-400" size={20} />
          </div>
        </button>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Démarrer une séance</h2>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => startWorkout(name)}
              className="glass rounded-xl px-3 py-3 text-sm font-medium active:scale-95 transition-transform"
            >
              {name}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const name = prompt('Nom de la séance ?')
            if (name) startWorkout(name)
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-400 active:bg-zinc-900"
        >
          <Plus size={16} /> Séance personnalisée
        </button>
      </section>

      {loggedExercises.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">Progression</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {loggedExercises.map(({ exerciseId }) => {
              const ex = ALL_EXERCISES.find((e) => e.id === exerciseId)
              return (
                <button
                  key={exerciseId}
                  onClick={() => navigate(`/gym/exercise/${exerciseId}`)}
                  className="glass flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium active:scale-95 transition-transform"
                >
                  <TrendingUp size={13} className="text-orange-400" />
                  {ex?.name ?? exerciseId}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Historique</h2>
        {loading && <p className="text-sm text-zinc-500">Chargement…</p>}
        {!loading && workouts.filter((w) => w.finishedAt).length === 0 && (
          <p className="text-sm text-zinc-500">Aucune séance terminée pour le moment.</p>
        )}
        <ul className="space-y-2">
          {workouts
            .filter((w) => w.finishedAt)
            .map((w) => {
              const totalSets = w.exercises.reduce((n, e) => n + e.sets.length, 0)
              const prCount = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.isPr).length, 0)
              return (
                <li key={w.id} className="glass flex items-center gap-1 rounded-xl p-3">
                  <button onClick={() => navigate(`/gym/workout/${w.id}`)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{w.name}</p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(w.startedAt)} · {formatTime(w.startedAt)}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                      <span>{w.exercises.length} exercices</span>
                      <span>{totalSets} séries</span>
                      {prCount > 0 && (
                        <span className="flex items-center gap-0.5 text-orange-400">
                          <Flame size={12} /> {prCount} PR
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => removeWorkout(w.id, w.name)}
                    className="shrink-0 rounded-full p-2 text-zinc-600 active:bg-red-500/10 active:text-red-400"
                    aria-label="Supprimer la séance"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              )
            })}
        </ul>
      </section>
      </div>
    </div>
  )
}
