import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bookmark, ChevronLeft, Plus } from 'lucide-react'
import { getWorkout, saveWorkout, finishWorkout as finishWorkoutAndSync, getBestPerformance, detectPr } from '../../lib/workouts'
import { newId } from '../../lib/db'
import { getSettings } from '../../lib/settings'
import { getTodayGoogleFit, syncGoogleFit } from '../../lib/googleFit'
import RestTimer from '../../components/RestTimer'
import WorkoutMusicPlayer from '../../components/WorkoutMusicPlayer'
import type { GoogleFitDay, SetEntry, Workout, WorkoutExercise } from '../../types'
import { SaveTemplateModal } from './SaveTemplateModal'
import { ExerciseBlock } from './ExerciseBlock'
import { ExercisePicker } from './ExercisePicker'
import { FocusExerciseView } from './FocusExerciseView'

export default function WorkoutRunner() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [restToken, setRestToken] = useState(0)
  const [googleFitToday, setGoogleFitToday] = useState<GoogleFitDay | null>(null)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [focusExerciseId, setFocusExerciseId] = useState<string | null>(null)
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
    if (!workout) return null
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
    return { id: entry.id, isPr }
  }

  async function applyDifficultyToSets(exerciseId: string, setIds: string[], rpe: number) {
    if (!workout) return
    const setIdSet = new Set(setIds)
    const next: Workout = {
      ...workout,
      exercises: workout.exercises.map((we) =>
        we.exerciseId === exerciseId ? { ...we, sets: we.sets.map((s) => (setIdSet.has(s.id) ? { ...s, rpe } : s)) } : we,
      ),
    }
    await persist(next)
  }

  async function updateSetHeartRate(exerciseId: string, setId: string, bpm: number) {
    if (!workout) return
    const next: Workout = {
      ...workout,
      exercises: workout.exercises.map((we) =>
        we.exerciseId === exerciseId ? { ...we, sets: we.sets.map((s) => (s.id === setId ? { ...s, heartRateBpm: bpm } : s)) } : we,
      ),
    }
    await persist(next)
  }

  function removeExercise(exerciseId: string) {
    if (!workout) return
    if (!confirm('Supprimer cet exercice de la séance ? Toutes ses séries seront perdues.')) return
    persist({ ...workout, exercises: workout.exercises.filter((we) => we.exerciseId !== exerciseId) })
  }

  /** Correction a posteriori du poids/reps d'une série déjà loguée (erreur de
   * saisie) — ne retouche jamais isPr, qui dépend du contexte des séries
   * précédentes au moment où elle a été loguée. */
  function updateSet(exerciseId: string, setId: string, patch: { weightKg: number; reps: number }) {
    if (!workout) return
    persist({
      ...workout,
      exercises: workout.exercises.map((we) =>
        we.exerciseId === exerciseId ? { ...we, sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : we,
      ),
    })
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
      <WorkoutMusicPlayer />

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
            onFocus={() => setFocusExerciseId(we.exerciseId)}
            onRemove={() => removeExercise(we.exerciseId)}
            onEditSet={(setId, patch) => updateSet(we.exerciseId, setId, patch)}
          />
        ))}

        <button
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-400 active:bg-zinc-900"
        >
          <Plus size={16} /> Ajouter un exercice
        </button>

        {workout.exercises.length > 0 && (
          <button
            onClick={() => setSaveTemplateOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-zinc-500 active:text-zinc-300"
          >
            <Bookmark size={13} /> Enregistrer comme modèle
          </button>
        )}
      </div>

      {pickerOpen && (
        <ExercisePicker onPick={addExercise} onClose={() => setPickerOpen(false)} exclude={workout.exercises.map((e) => e.exerciseId)} />
      )}

      {saveTemplateOpen && <SaveTemplateModal workout={workout} onClose={() => setSaveTemplateOpen(false)} />}

      {focusExerciseId &&
        (() => {
          const we = workout.exercises.find((e) => e.exerciseId === focusExerciseId)
          if (!we) return null
          return (
            <FocusExerciseView
              we={we}
              onAddSet={(s) => addSet(we.exerciseId, s)}
              onFinish={async (setIds, rpe) => {
                await applyDifficultyToSets(we.exerciseId, setIds, rpe)
                setFocusExerciseId(null)
              }}
              onHeartRate={(setId, bpm) => updateSetHeartRate(we.exerciseId, setId, bpm)}
              onClose={() => setFocusExerciseId(null)}
              onRemoveExercise={() => {
                removeExercise(we.exerciseId)
                setFocusExerciseId(null)
              }}
            />
          )
        })()}
    </div>
  )
}
