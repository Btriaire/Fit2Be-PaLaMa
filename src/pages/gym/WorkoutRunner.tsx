import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Copy, Flame, HeartPulse, Plus, Search, X } from 'lucide-react'
import clsx from 'clsx'
import {
  getWorkout,
  saveWorkout,
  finishWorkout as finishWorkoutAndSync,
  getLastPerformance,
  getBestPerformance,
  detectPr,
  estimateExerciseDurationMin,
  type LastPerformance,
} from '../../lib/workouts'
import { newId } from '../../lib/db'
import { ALL_EXERCISES, MUSCLE_GROUPS } from '../../lib/exercises'
import { getSettings } from '../../lib/settings'
import { getTodayGoogleFit, syncGoogleFit } from '../../lib/googleFit'
import RestTimer from '../../components/RestTimer'
import MuscleBodyMap from '../../components/MuscleBodyMap'
import HeartRateMeter from '../../components/HeartRateMeter'
import type { GoogleFitDay, SetEntry, Workout, WorkoutExercise } from '../../types'

export default function WorkoutRunner() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [restToken, setRestToken] = useState(0)
  const [googleFitToday, setGoogleFitToday] = useState<GoogleFitDay | null>(null)
  const settings = getSettings()

  useEffect(() => {
    if (!workoutId) return
    getWorkout(workoutId).then((w) => setWorkout(w ?? null))
  }, [workoutId])

  useEffect(() => {
    getTodayGoogleFit().then(setGoogleFitToday)
    syncGoogleFit().then(() => getTodayGoogleFit().then(setGoogleFitToday))
  }, [])

  async function persist(next: Workout) {
    setWorkout(next)
    await saveWorkout(next)
  }

  function setExerciseHeartRate(exerciseId: string, bpm: number, source: 'camera' | 'googlefit') {
    if (!workout) return
    persist({
      ...workout,
      exercises: workout.exercises.map((we) =>
        we.exerciseId === exerciseId ? { ...we, heartRateBpm: bpm, heartRateMeasuredAt: Date.now(), heartRateSource: source } : we,
      ),
    })
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
    const finished = await finishWorkoutAndSync(workout, settings)
    setWorkout(finished)
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
          <ExerciseBlock
            key={we.exerciseId}
            we={we}
            onAddSet={(s) => addSet(we.exerciseId, s)}
            onHeartRate={(bpm, source) => setExerciseHeartRate(we.exerciseId, bpm, source)}
            googleFitHeartRateAvg={googleFitToday?.heartRateAvg ?? null}
            restTimerDefaultSec={settings.restTimerDefaultSec}
          />
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
  onHeartRate,
  googleFitHeartRateAvg,
  restTimerDefaultSec,
}: {
  we: WorkoutExercise
  onAddSet: (set: Omit<SetEntry, 'id' | 'exerciseId' | 'completedAt' | 'isPr'>) => void
  onHeartRate: (bpm: number, source: 'camera' | 'googlefit') => void
  googleFitHeartRateAvg: number | null
  restTimerDefaultSec: number
}) {
  const exercise = ALL_EXERCISES.find((e) => e.id === we.exerciseId)
  const estimatedMin = estimateExerciseDurationMin(restTimerDefaultSec)
  const [last, setLast] = useState<LastPerformance | null>(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [warmup, setWarmup] = useState(false)
  const [meterOpen, setMeterOpen] = useState(false)

  const displayHeartRate = we.heartRateBpm
    ? { bpm: we.heartRateBpm, source: we.heartRateSource ?? 'camera' }
    : googleFitHeartRateAvg
      ? { bpm: googleFitHeartRateAvg, source: 'googlefit' as const }
      : null

  useEffect(() => {
    getLastPerformance(we.exerciseId).then((lp) => {
      setLast(lp)
      // Pré-remplit avec les réglages de la dernière fois, tant que rien
      // n'a encore été saisi ni loggé sur cet exercice dans cette séance.
      if (lp && we.sets.length === 0) {
        setWeight((w) => w || String(lp.weightKg))
        setReps((r) => r || String(lp.reps))
      }
    })
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

  function duplicateLastSet() {
    const prev = we.sets[we.sets.length - 1]
    if (!prev) return
    onAddSet({ weightKg: prev.weightKg, reps: prev.reps, rpe: prev.rpe, isWarmup: false })
  }

  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-2.5">
          {exercise?.images?.[0] && (
            <img src={exercise.images[0]} alt="" loading="lazy" className="h-20 w-20 shrink-0 self-center rounded-xl bg-zinc-900 object-cover" />
          )}
          <div>
            <h3 className="font-semibold">{exercise?.name ?? we.exerciseId}</h3>
            <p className="text-[11px] text-zinc-600">
              ~{estimatedMin} min estimées
              {we.targetSets && we.targetReps && (
                <span className="ml-1.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 font-mono text-orange-400">
                  cible {we.targetSets}×{we.targetReps}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {last && (
            <p className="text-xs text-zinc-500">
              Dernière fois : {last.weightKg}kg × {last.reps}
            </p>
          )}
          <button
            onClick={() => setMeterOpen(true)}
            className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-medium text-red-400 active:bg-zinc-800"
          >
            <HeartPulse size={12} /> Mesurer
          </button>
        </div>
      </div>
      {we.note && <p className="mb-2.5 text-xs leading-snug text-zinc-500">{we.note}</p>}

      {displayHeartRate && (
        <div className="mb-2.5 flex items-center gap-3 rounded-xl bg-zinc-900/70 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500">
            <HeartPulse size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums text-white">{displayHeartRate.bpm}</span>
              <span className="text-xs text-zinc-500">bpm</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Rythme cardiaque · {displayHeartRate.source === 'camera' ? 'mesuré à la caméra' : 'moy. Google Fit aujourd\'hui'}
            </p>
          </div>
        </div>
      )}

      {meterOpen && (
        <HeartRateMeter
          onClose={() => setMeterOpen(false)}
          onMeasured={(bpm) => {
            onHeartRate(bpm, 'camera')
            setMeterOpen(false)
          }}
        />
      )}

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

      {we.sets.length > 0 && (
        <button
          onClick={duplicateLastSet}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-2 text-xs font-medium text-zinc-400 active:bg-zinc-800"
        >
          <Copy size={13} /> Même série ({we.sets[we.sets.length - 1].weightKg}kg × {we.sets[we.sets.length - 1].reps})
        </button>
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
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
  const DISPLAY_LIMIT = 60
  const estimatedMin = estimateExerciseDurationMin(getSettings().restTimerDefaultSec)

  const filtered = ALL_EXERCISES.filter(
    (e) =>
      !exclude.includes(e.id) &&
      e.name.toLowerCase().includes(q.toLowerCase()) &&
      (!muscleFilter || e.muscleGroup === muscleFilter),
  )
  const results = filtered.slice(0, DISPLAY_LIMIT)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
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
            placeholder="Rechercher parmi 675+ exercices…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <MuscleBodyMap selected={muscleFilter} onSelect={setMuscleFilter} />
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setMuscleFilter(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              muscleFilter === null ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            Tous
          </button>
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m}
              onClick={() => setMuscleFilter(m === muscleFilter ? null : m)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                muscleFilter === m ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <ul className="space-y-1 pb-2">
          {results.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onPick(e.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left active:bg-zinc-900"
              >
                {e.images?.[0] ? (
                  <img src={e.images[0]} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl bg-zinc-900 object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-xl bg-zinc-900" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-zinc-500">
                    {e.muscleGroup} · {e.equipment} · ~{estimatedMin}min
                  </p>
                </div>
              </button>
            </li>
          ))}
          {results.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">Aucun résultat.</p>}
        </ul>
        {filtered.length > DISPLAY_LIMIT && (
          <p className="pb-4 text-center text-xs text-zinc-600">
            {filtered.length - DISPLAY_LIMIT} exercices supplémentaires — affine ta recherche pour les voir.
          </p>
        )}
      </div>
    </div>
  )
}
