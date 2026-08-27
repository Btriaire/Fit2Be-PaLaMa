import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, ChevronRight, Flame, TrendingUp, Trash2, Target, X } from 'lucide-react'
import { getAllWorkouts, saveWorkout, deleteWorkout, getLoggedExerciseIds } from '../../lib/workouts'
import { newId } from '../../lib/db'
import { formatDate, formatTime } from '../../lib/date'
import { ALL_EXERCISES } from '../../lib/exercises'
import { TRAINING_TEMPLATES, type TrainingTemplate } from '../../lib/trainingTemplates'
import ActivityHero from '../../components/ActivityHero'
import type { Workout, WorkoutExercise } from '../../types'

const QUICK_NAMES = ['Push Day', 'Pull Day', 'Leg Day', 'Full Body', 'Haut du corps', 'Bas du corps']

export default function GymHome() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedExercises, setLoggedExercises] = useState<Array<{ exerciseId: string; lastDate: number }>>([])
  const [previewTemplate, setPreviewTemplate] = useState<TrainingTemplate | null>(null)

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

  async function startFromTemplate(tpl: TrainingTemplate) {
    const exercises: WorkoutExercise[] = tpl.exercises.map((te, order) => ({
      exerciseId: te.exerciseId,
      order,
      sets: [],
      targetSets: te.targetSets,
      targetReps: te.targetReps,
      note: te.note,
    }))
    const workout: Workout = { id: newId(), name: tpl.name, startedAt: Date.now(), exercises }
    await saveWorkout(workout)
    setPreviewTemplate(null)
    navigate(`/gym/workout/${workout.id}`)
  }

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

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Templates par chef musculaire</h2>
        <div className="space-y-2">
          {TRAINING_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setPreviewTemplate(tpl)}
              className="glass flex w-full items-center gap-3 rounded-xl p-3.5 text-left active:scale-[0.98] transition-transform"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                <Target size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{tpl.name}</p>
                <p className="truncate text-xs text-zinc-500">{tpl.focus}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-zinc-600" />
            </button>
          ))}
        </div>
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

      {previewTemplate && (
        <TemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onStart={() => startFromTemplate(previewTemplate)}
        />
      )}
    </div>
  )
}

function TemplatePreview({
  template,
  onClose,
  onStart,
}: {
  template: TrainingTemplate
  onClose: () => void
  onStart: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">{template.name}</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-orange-400">{template.focus}</p>
          <p className="mb-4 text-sm text-zinc-400">{template.description}</p>

          <ul className="space-y-2.5">
            {template.exercises.map((te) => {
              const ex = ALL_EXERCISES.find((e) => e.id === te.exerciseId)
              return (
                <li key={te.exerciseId} className="glass flex gap-2.5 rounded-xl p-3">
                  {ex?.images?.[0] ? (
                    <img src={ex.images[0]} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg bg-zinc-900 object-cover" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-900" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{ex?.name ?? te.exerciseId}</p>
                      <span className="shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-orange-400">
                        {te.targetSets}×{te.targetReps}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {ex?.muscleGroup} · {ex?.equipment}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-zinc-400">{te.note}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Bouton en pied fixe, hors de la zone qui défile — sur les templates
            longs (Jambes: 7 exercices), il finissait en bas de la liste
            scrollable, potentiellement caché par la zone de home-indicator
            iPhone ou hors d'atteinte sans scroller jusqu'au bout. */}
        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={onStart}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-zinc-950 active:bg-orange-400"
          >
            Démarrer cette séance
          </button>
        </div>
      </div>
    </div>
  )
}
