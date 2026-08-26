import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Flame, Plus, Search, X } from 'lucide-react'
import clsx from 'clsx'
import { getWorkout, saveWorkout, getLastPerformance, getBestPerformance, detectPr, type LastPerformance } from '../../lib/workouts'
import { newId } from '../../lib/db'
import { SEED_EXERCISES } from '../../lib/exercises'
import { getSettings } from '../../lib/settings'
import RestTimer from '../../components/RestTimer'
import type { SetEntry, Workout, WorkoutExercise } from '../../types'

export default function WorkoutRunner() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [restToken, setRestToken] = useState(0)
  const settings = getSettings()

  useEffect(() => {
    if (!workoutId) return
    getWorkout(workoutId).then((w) => setWorkout(w ?? null))
  }, [workoutId])

  async function persist(next: Workout) {
    setWorkout(next)
    await saveWorkout(next)
  }

  function addExercise(exerciseId: string) {
    if (!workout) return
    const we: WorkoutExercise = { exerciseId, order: workout.exercises.length, sets: [] }
    persist({ ...workout, exercises: [...workout.exercises, we] })
    setPickerOpen(false)
  }

  async function addSet(exerciseId: string, set: Omit<SetEntry, 'id' | 'exerciseId' | 'completedAt' | 'isPr'>) {
    if (!workout) return
    const best = await getBestPerformance(exerciseId, workout.id)
    const isPr = detectPr(set, best)
    const entry: SetEntry = { ...set, id: newId(), exerciseId, completedAt: Date.now(), isPr }
    const next: Workout = {
      ...workout,
      exercises: workout.exercises.map((we) =>
        we.exerciseId === exerciseId ? { ...we, sets: [...we.sets, entry] } : we,
      ),
    }
    await persist(next)
    if (!set.isWarmup) setRestToken((t) => t + 1)
  }

  async function finishWorkout() {
    if (!workout) return
    await persist({ ...workout, finishedAt: Date.now() })
    navigate('/gym')
  }

  if (!workout) {
    return <div className="p-4 text-sm text-zinc-500">Chargement…</div>
  }

  return (
    <div>
      <RestTimer durationSec={settings.restTimerDefaultSec} runToken={restToken} />

      <header className="flex items-center justify-between px-4 pt-4">
        <button onClick={() => navigate('/gym')} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-semibold">{workout.name}</h1>
        <button
          onClick={finishWorkout}
          className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 active:bg-orange-400"
        >
          Terminer
        </button>
      </header>

      <div className="space-y-4 px-4 py-4">
        {workout.exercises.map((we) => (
          <ExerciseBlock key={we.exerciseId} we={we} onAddSet={(s) => addSet(we.exerciseId, s)} />
        ))}

        <button
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-400 active:bg-zinc-900"
        >
          <Plus size={16} /> Ajouter un exercice
        </button>
      </div>

      {pickerOpen && (
        <ExercisePicker onPick={addExercise} onClose={() => setPickerOpen(false)} exclude={workout.exercises.map((e) => e.exerciseId)} />
      )}
    </div>
  )
}

function ExerciseBlock({
  we,
  onAddSet,
}: {
  we: WorkoutExercise
  onAddSet: (set: Omit<SetEntry, 'id' | 'exerciseId' | 'completedAt' | 'isPr'>) => void
}) {
  const exercise = SEED_EXERCISES.find((e) => e.id === we.exerciseId)
  const [last, setLast] = useState<LastPerformance | null>(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [warmup, setWarmup] = useState(false)

  useEffect(() => {
    getLastPerformance(we.exerciseId).then(setLast)
  }, [we.exerciseId, we.sets.length])

  function submit() {
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    if (!w || !r) return
    onAddSet({ weightKg: w, reps: r, rpe: rpe ? parseFloat(rpe) : undefined, isWarmup: warmup })
    setWeight('')
    setReps('')
    setRpe('')
    setWarmup(false)
  }

  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-semibold">{exercise?.name ?? we.exerciseId}</h3>
        {last && (
          <p className="text-xs text-zinc-500">
            Dernière fois : {last.weightKg}kg × {last.reps}
          </p>
        )}
      </div>

      {we.sets.length > 0 && (
        <ul className="mb-2 space-y-1">
          {we.sets.map((s, i) => (
            <li
              key={s.id}
              className={clsx(
                'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm',
                s.isWarmup ? 'bg-zinc-900/60 text-zinc-500' : 'bg-zinc-900',
              )}
            >
              <span>
                Série {i + 1} {s.isWarmup && <span className="text-[10px] uppercase">échauf.</span>}
              </span>
              <span className="flex items-center gap-2 font-mono tabular-nums">
                {s.weightKg}kg × {s.reps}
                {s.rpe ? <span className="text-zinc-500">RPE{s.rpe}</span> : null}
                {s.isPr && (
                  <span className="flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400">
                    <Flame size={10} /> PR
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5">
        <input
          inputMode="decimal"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-16 rounded-lg bg-zinc-900 px-2 py-2 text-center text-sm outline-none focus:ring-1 focus:ring-orange-500"
        />
        <span className="text-zinc-600">×</span>
        <input
          inputMode="numeric"
          placeholder="reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="w-16 rounded-lg bg-zinc-900 px-2 py-2 text-center text-sm outline-none focus:ring-1 focus:ring-orange-500"
        />
        <input
          inputMode="numeric"
          placeholder="RPE"
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          className="w-14 rounded-lg bg-zinc-900 px-2 py-2 text-center text-sm outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          onClick={() => setWarmup((v) => !v)}
          className={clsx(
            'shrink-0 rounded-lg px-2 py-2 text-[10px] font-semibold uppercase',
            warmup ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-900 text-zinc-500',
          )}
        >
          Éch.
        </button>
        <button
          onClick={submit}
          className="ml-auto flex shrink-0 items-center justify-center rounded-lg bg-orange-500 p-2.5 text-zinc-950 active:bg-orange-400"
        >
          <Check size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

function ExercisePicker({
  onPick,
  onClose,
  exclude,
}: {
  onPick: (id: string) => void
  onClose: () => void
  exclude: string[]
}) {
  const [q, setQ] = useState('')
  const results = SEED_EXERCISES.filter(
    (e) => !exclude.includes(e.id) && e.name.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Choisir un exercice</h2>
          <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
            <X size={18} />
          </button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2">
          <Search size={16} className="text-zinc-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="space-y-1 pb-4">
          {results.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onPick(e.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left active:bg-zinc-900"
              >
                <span className="text-sm font-medium">{e.name}</span>
                <span className="text-xs text-zinc-500">{e.muscleGroup}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">Aucun résultat.</p>}
        </ul>
      </div>
    </div>
  )
}
