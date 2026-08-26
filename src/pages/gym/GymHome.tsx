import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, ChevronRight, Flame } from 'lucide-react'
import { getAllWorkouts, saveWorkout } from '../../lib/workouts'
import { newId } from '../../lib/db'
import { formatDate, formatTime } from '../../lib/date'
import type { Workout } from '../../types'

const QUICK_NAMES = ['Push Day', 'Pull Day', 'Leg Day', 'Full Body', 'Haut du corps', 'Bas du corps']

export default function GymHome() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllWorkouts().then((w) => {
      setWorkouts(w)
      setLoading(false)
    })
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

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Dumbbell className="text-orange-400" size={26} />
        <h1 className="text-xl font-semibold tracking-tight">Gym & Fitness</h1>
      </header>

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
                <li key={w.id}>
                  <button
                    onClick={() => navigate(`/gym/workout/${w.id}`)}
                    className="glass w-full rounded-xl p-3 text-left"
                  >
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
                </li>
              )
            })}
        </ul>
      </section>
    </div>
  )
}
