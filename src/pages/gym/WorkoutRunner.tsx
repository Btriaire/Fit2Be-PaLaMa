import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bookmark, Check, ChevronDown, ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { getWorkout, saveWorkout, finishWorkout as finishWorkoutAndSync, getBestPerformance, detectPr, deleteWorkout, estimateWorkoutCalories } from '../../lib/workouts'
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
  function updateSet(exerciseId: string, setId: string, patch: { weightKg: number; reps: number; rpe?: number; isWarmup: boolean }) {
    if (!workout) return
    persist({
      ...workout,
      exercises: workout.exercises.map((we) =>
        we.exerciseId === exerciseId
          ? {
              ...we,
              sets: we.sets.map((s) => {
                if (s.id !== setId) return s
                const next = { ...s, ...patch }
                if (patch.rpe === undefined) delete next.rpe
                return next
              }),
            }
          : we,
      ),
    })
  }

  function deleteSet(exerciseId: string, setId: string) {
    if (!workout) return
    persist({
      ...workout,
      exercises: workout.exercises.map((we) => (we.exerciseId === exerciseId ? { ...we, sets: we.sets.filter((s) => s.id !== setId) } : we)),
    })
  }

  async function removeWholeWorkout() {
    if (!workout || !confirm(`Supprimer la séance "${workout.name}" ?`)) return
    await deleteWorkout(workout.id)
    navigate('/gym')
  }

  async function finishWorkout() {
    if (!workout) return
    // Une séance déjà terminée qu'on rouvre pour la corriger : surtout ne pas refixer sa
    // fin à maintenant (une séance d'il y a 3 jours durait sinon 3 jours, calories comprises).
    if (workout.finishedAt) {
      navigate('/gym')
      return
    }
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
        <h1 className="min-w-0 flex-1 truncate px-2 text-center text-base font-semibold">{workout.name}</h1>
        <button
          onClick={finishWorkout}
          className="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 active:bg-orange-400"
        >
          {workout.finishedAt ? (
            <>
              <Check size={13} strokeWidth={3} /> OK
            </>
          ) : (
            'Terminer'
          )}
        </button>
      </header>

      <div className="space-y-4 px-4 py-4">
        <WorkoutDetailsCard workout={workout} kcal={estimateWorkoutCalories(workout, settings)} onChange={persist} onDelete={removeWholeWorkout} />
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
            onDeleteSet={(setId) => deleteSet(we.exerciseId, setId)}
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

const pad = (n: number) => String(n).padStart(2, '0')
const dateInput = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const timeInput = (ts: number) => {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Nom, date, heure, durée et notes de la séance — modifiables à tout moment, même des jours après. */
function WorkoutDetailsCard({
  workout,
  kcal,
  onChange,
  onDelete,
}: {
  workout: Workout
  kcal: number
  onChange: (w: Workout) => void
  onDelete: () => void
}) {
  const finished = !!workout.finishedAt
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(workout.name)
  const [date, setDate] = useState(dateInput(workout.startedAt))
  const [time, setTime] = useState(timeInput(workout.startedAt))
  const [duration, setDuration] = useState(workout.finishedAt ? String(Math.max(1, Math.round((workout.finishedAt - workout.startedAt) / 60000))) : '')
  const [notes, setNotes] = useState(workout.notes ?? '')
  const durationMin = workout.finishedAt ? Math.round((workout.finishedAt - workout.startedAt) / 60000) : null

  function save() {
    const startedAt = new Date(`${date}T${time || '12:00'}:00`).getTime()
    const dur = parseInt(duration, 10)
    onChange({
      ...workout,
      name: name.trim() || workout.name,
      startedAt,
      ...(finished && dur > 0 ? { finishedAt: startedAt + dur * 60000 } : {}),
      notes: notes.trim() || undefined,
    })
    setOpen(false)
  }

  const field = 'w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-orange-500'
  return (
    <div className="glass rounded-2xl p-3.5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="min-w-0">
          <span className="block text-xs text-zinc-500">
            {finished ? 'Séance terminée — corrige ce que tu veux, tout est enregistré' : 'Séance en cours'}
          </span>
          <span className="mt-0.5 block text-sm text-zinc-200">
            {new Date(workout.startedAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {timeInput(workout.startedAt)}
            {durationMin != null && ` · ${durationMin} min · ${kcal} kcal`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-orange-300">
          <Pencil size={12} /> Détails <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2.5">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} text-left`} />
          </div>
          <div className={`grid gap-2 ${finished ? 'grid-cols-[1.5fr_1fr_1fr]' : 'grid-cols-2'}`}>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} px-1.5`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Début</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </div>
            {finished && (
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Durée (min)</label>
                <input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} className={field} />
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <p className="text-[11px] text-zinc-500">Touche une série pour corriger poids, reps, RPE, échauffement ou la supprimer.</p>
          <div className="flex gap-2">
            <button onClick={onDelete} className="flex items-center gap-1 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs font-medium text-red-400 active:bg-red-500/10">
              <Trash2 size={13} /> Supprimer la séance
            </button>
            <button onClick={save} className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-zinc-950 active:bg-orange-400">
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
