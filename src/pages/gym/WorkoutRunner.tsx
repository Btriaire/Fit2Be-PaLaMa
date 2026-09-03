import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bookmark, Camera, Check, ChevronDown, ChevronLeft, Copy, Flame, HeartPulse, Pencil, Play, Plus, Search, Trash2, X } from 'lucide-react'
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
import { saveCustomTemplate, exercisesFromWorkout, compressImageToDataUrl } from '../../lib/customTemplates'
import { playMotivation } from '../../lib/motivationVoice'
import { useCollapsible } from '../../lib/useCollapsible'
import RestTimer from '../../components/RestTimer'
import MuscleBodyMap from '../../components/MuscleBodyMap'
import Collapsible from '../../components/Collapsible'
import HeartRateMeter from '../../components/HeartRateMeter'
import WorkoutMusicPlayer from '../../components/WorkoutMusicPlayer'
import type { GoogleFitDay, SetEntry, Workout, WorkoutExercise } from '../../types'

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

function SaveTemplateModal({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [name, setName] = useState(workout.name)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setPhotoDataUrl(await compressImageToDataUrl(file))
    } catch {
      // photo optionnelle — un échec de lecture/compression ne doit pas bloquer la sauvegarde
    }
  }

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    await saveCustomTemplate(name.trim(), exercisesFromWorkout(workout), photoDataUrl ?? undefined)
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop w-full max-w-md rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Enregistrer comme modèle</h2>
          <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-zinc-900 text-zinc-600">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera size={20} />
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </label>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Nom du modèle</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          {workout.exercises.length} exercice{workout.exercises.length > 1 ? 's' : ''} — réutilisable depuis "Mes modèles" sur l'accueil Gym.
        </p>

        <button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-zinc-950 active:bg-orange-400 disabled:opacity-50"
        >
          {saved ? 'Enregistré ✓' : saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

function ExerciseBlock({
  we,
  onAddSet,
  onHeartRate,
  googleFitHeartRateAvg,
  restTimerDefaultSec,
  onFocus,
  onRemove,
  onEditSet,
}: {
  we: WorkoutExercise
  onAddSet: (set: Omit<SetEntry, 'id' | 'exerciseId' | 'completedAt' | 'isPr'>) => void
  onHeartRate: (bpm: number, source: 'camera' | 'googlefit') => void
  googleFitHeartRateAvg: number | null
  restTimerDefaultSec: number
  onFocus: () => void
  onRemove: () => void
  onEditSet: (setId: string, patch: { weightKg: number; reps: number }) => void
}) {
  const exercise = ALL_EXERCISES.find((e) => e.id === we.exerciseId)
  const estimatedMin = estimateExerciseDurationMin(restTimerDefaultSec)
  const [last, setLast] = useState<LastPerformance | null>(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [warmup, setWarmup] = useState(false)
  const [meterOpen, setMeterOpen] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')

  function startEditSet(s: SetEntry) {
    setEditingSetId(s.id)
    setEditWeight(String(s.weightKg))
    setEditReps(String(s.reps))
  }

  function confirmEditSet() {
    const w = parseFloat(editWeight)
    const r = parseInt(editReps, 10)
    if (!w || !r || !editingSetId) return
    onEditSet(editingSetId, { weightKg: w, reps: r })
    setEditingSetId(null)
  }

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
      // Pas d'historique (1ère fois sur cet exercice) : reprend la cible du
      // template ("8-10" -> 8) plutôt que de laisser le champ vide.
      if (!lp && we.sets.length === 0 && we.targetReps) {
        const firstNumber = we.targetReps.match(/\d+/)?.[0]
        if (firstNumber) setReps((r) => r || firstNumber)
      }
    })
  }, [we.exerciseId, we.sets.length, we.targetReps])

  function submit() {
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    if (!w || !r) return
    onAddSet({ weightKg: w, reps: r, rpe: rpe ? parseFloat(rpe) : undefined, isWarmup: warmup })
    // Garde poids/reps pré-remplis pour la série suivante (souvent identiques,
    // même logique que le mode Focus) — seuls RPE et warmup sont propres à
    // chaque série et doivent repartir de zéro.
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMeterOpen(true)}
              className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-medium text-red-400 active:bg-zinc-800"
            >
              <HeartPulse size={12} /> Mesurer
            </button>
            <button
              onClick={onRemove}
              aria-label="Supprimer cet exercice"
              className="rounded-full bg-zinc-900 p-1.5 text-zinc-600 active:bg-red-500/10 active:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
      {we.note && <p className="mb-2.5 text-xs leading-snug text-zinc-500">{we.note}</p>}

      <button
        onClick={onFocus}
        className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-zinc-950 active:bg-orange-400"
      >
        <Play size={16} fill="currentColor" /> Lancer le mode Focus
      </button>

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
          {we.sets.map((s, i) =>
            editingSetId === s.id ? (
              <li key={s.id} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5">
                <input
                  inputMode="decimal"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-14 rounded-md bg-zinc-800 px-1.5 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-orange-500"
                />
                <span className="text-zinc-600">×</span>
                <input
                  inputMode="numeric"
                  value={editReps}
                  onChange={(e) => setEditReps(e.target.value)}
                  className="w-14 rounded-md bg-zinc-800 px-1.5 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button onClick={confirmEditSet} className="ml-auto rounded-md bg-orange-500 p-1.5 text-zinc-950 active:bg-orange-400">
                  <Check size={13} strokeWidth={3} />
                </button>
                <button onClick={() => setEditingSetId(null)} className="rounded-md bg-zinc-800 p-1.5 text-zinc-400 active:bg-zinc-700">
                  <X size={13} />
                </button>
              </li>
            ) : (
              <li
                key={s.id}
                onClick={() => startEditSet(s)}
                className={clsx(
                  'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm active:bg-zinc-800',
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
                  <Pencil size={11} className="text-zinc-700" />
                </span>
              </li>
            ),
          )}
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
  const [bodyMapOpen, setBodyMapOpen] = useCollapsible('gym-picker-bodymap')
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
        className="mesh-backdrop flex max-h-[75vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête + filtres hors de la zone qui défile : mesh-backdrop pose
            overflow:hidden pour clipper son fond dégradé décoratif, ce qui
            écrasait overflow-y-auto quand les deux étaient sur le même
            élément (Tailwind v4 charge ses utilitaires dans un @layer, donc
            n'importe quelle règle CSS normale comme .mesh-backdrop passe
            devant) — plus aucun scroll possible dans la liste en dessous. */}
        <div className="shrink-0 p-4 pb-0">
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
          <button
            onClick={() => setBodyMapOpen((v) => !v)}
            className="mb-2 flex w-full items-center justify-between text-xs font-medium text-zinc-500"
          >
            <span>Filtrer par silhouette{muscleFilter ? ` — ${muscleFilter}` : ''}</span>
            <ChevronDown size={14} className={`text-zinc-600 transition-transform ${bodyMapOpen ? 'rotate-180' : ''}`} />
          </button>
          <Collapsible open={bodyMapOpen}>
            <div className="pb-1">
              <MuscleBodyMap selected={muscleFilter} onSelect={setMuscleFilter} />
            </div>
          </Collapsible>
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
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
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
    </div>
  )
}

const DIFFICULTY_LEVELS: Array<{ label: string; rpe: number; color: string }> = [
  { label: 'Facile', rpe: 3, color: 'bg-teal-500/15 text-teal-400' },
  { label: 'Modéré', rpe: 5, color: 'bg-teal-500/15 text-teal-400' },
  { label: 'Difficile', rpe: 7, color: 'bg-orange-500/15 text-orange-400' },
  { label: 'Très difficile', rpe: 8.5, color: 'bg-orange-500/15 text-orange-400' },
  { label: 'Échec musculaire', rpe: 10, color: 'bg-red-500/15 text-red-400' },
]

// Vue plein écran isolée sur un seul exercice — demande le "niveau de
// difficulté" après chaque série plutôt qu'un champ RPE optionnel qu'on
// oublie de remplir, pour que la charge réelle remonte fiablement vers
// Progression et Récupération (méthode session-RPE, voir lib/recovery.ts).
function FocusExerciseView({
  we,
  onAddSet,
  onFinish,
  onHeartRate,
  onClose,
  onRemoveExercise,
}: {
  we: WorkoutExercise
  onAddSet: (
    set: Omit<SetEntry, 'id' | 'exerciseId' | 'completedAt' | 'isPr'>,
  ) => Promise<{ id: string; isPr: boolean } | null | undefined>
  onFinish: (setIds: string[], rpe: number) => void
  onHeartRate: (setId: string, bpm: number) => void
  onClose: () => void
  onRemoveExercise: () => void
}) {
  const exercise = ALL_EXERCISES.find((e) => e.id === we.exerciseId)
  const [last, setLast] = useState<LastPerformance | null>(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [awaitingDifficulty, setAwaitingDifficulty] = useState(false)
  const [sessionSetIds, setSessionSetIds] = useState<string[]>([])
  const [lastLoggedSetId, setLastLoggedSetId] = useState<string | null>(null)
  const [hrMeterOpen, setHrMeterOpen] = useState(false)

  const doneCount = we.sets.filter((s) => !s.isWarmup).length
  const targetReached = we.targetSets != null && doneCount >= we.targetSets

  // Pré-remplissage, par ordre de priorité :
  // 1. Une série déjà loggée sur cet exercice PLUS TÔT dans cette séance (ex:
  //    on a fermé puis rouvert le mode Focus entre deux séries) — sinon
  //    rouvrir Focus reproposait des champs vides alors que la série 1 avait
  //    déjà été faite.
  // 2. La dernière performance connue (séance précédente).
  // 3. La cible du template ("8-10" -> 8), pour les reps uniquement (pas de
  //    poids cible connu dans un template).
  useEffect(() => {
    const lastSetThisWorkout = we.sets.length > 0 ? we.sets[we.sets.length - 1] : null
    if (lastSetThisWorkout) {
      setWeight(String(lastSetThisWorkout.weightKg))
      setReps(String(lastSetThisWorkout.reps))
    }
    getLastPerformance(we.exerciseId).then((lp) => {
      setLast(lp)
      if (lp && !lastSetThisWorkout) {
        setWeight((w) => w || String(lp.weightKg))
        setReps((r) => r || String(lp.reps))
      }
      if (!lp && !lastSetThisWorkout && we.targetReps) {
        const firstNumber = we.targetReps.match(/\d+/)?.[0]
        if (firstNumber) setReps((r) => r || firstNumber)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [we.exerciseId])

  async function submitSet() {
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    if (!w || !r) return
    const result = await onAddSet({ weightKg: w, reps: r, isWarmup: false })
    if (result) {
      setSessionSetIds((ids) => [...ids, result.id])
      setLastLoggedSetId(result.id)
      const settings = getSettings()
      if (settings.motivationVoice !== 'off') {
        void playMotivation(settings.motivationVoice, {
          kind: 'set',
          exercise: exercise?.name ?? we.exerciseId,
          weightKg: w,
          reps: r,
          isPr: result.isPr,
        })
      }
    }
    // Garde les valeurs pré-remplies pour la série suivante — souvent identiques.
  }

  function pickDifficulty(rpe: number) {
    onFinish(sessionSetIds, rpe)
    setAwaitingDifficulty(false)
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-zinc-950">
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-orange-400">Focus</p>
          <h1 className="truncate text-lg font-semibold">{exercise?.name ?? we.exerciseId}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onRemoveExercise}
            aria-label="Supprimer cet exercice"
            className="rounded-full bg-zinc-900 p-2 text-zinc-500 active:bg-red-500/10 active:text-red-400"
          >
            <Trash2 size={18} />
          </button>
          <button onClick={onClose} className="rounded-full bg-zinc-900 p-2 active:bg-zinc-800">
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-4">
        {exercise?.images?.[0] && (
          <img src={exercise.images[0]} alt="" className="mb-6 h-40 w-40 rounded-2xl bg-zinc-900 object-cover" />
        )}

        <p className="mb-1 text-sm text-zinc-400">
          Série <span className="font-mono text-zinc-200">{doneCount + 1}</span>
          {we.targetSets != null && <span> / {we.targetSets}</span>}
        </p>
        {we.targetSets != null && we.targetSets > 0 && (
          <div className="mb-3 flex items-center gap-1.5">
            {Array.from({ length: Math.max(we.targetSets, doneCount) }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i < doneCount ? 'bg-orange-500' : 'bg-zinc-800'}`}
              />
            ))}
          </div>
        )}
        {last && we.sets.length === 0 && (
          <p className="mb-5 text-xs text-zinc-600">
            Dernière fois : {last.weightKg}kg × {last.reps}
          </p>
        )}

        {!awaitingDifficulty ? (
          <>
            <div className="mb-6 flex items-center gap-4">
              <div className="text-center">
                <input
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-28 rounded-2xl bg-zinc-900 py-4 text-center text-3xl font-bold outline-none focus:ring-1 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-zinc-500">kg</p>
              </div>
              <span className="text-2xl text-zinc-600">×</span>
              <div className="text-center">
                <input
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-28 rounded-2xl bg-zinc-900 py-4 text-center text-3xl font-bold outline-none focus:ring-1 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-zinc-500">reps</p>
              </div>
            </div>
            <button
              onClick={submitSet}
              disabled={!weight || !reps}
              className="w-full max-w-xs rounded-2xl bg-orange-500 py-4 text-base font-semibold text-zinc-950 active:bg-orange-400 disabled:opacity-40"
            >
              Valider la série
            </button>
            {lastLoggedSetId && (
              <button
                onClick={() => setHrMeterOpen(true)}
                className="mt-3 flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-red-400 active:bg-zinc-800"
              >
                <HeartPulse size={13} />
                {we.sets.find((s) => s.id === lastLoggedSetId)?.heartRateBpm != null
                  ? `${we.sets.find((s) => s.id === lastLoggedSetId)?.heartRateBpm} bpm au repos`
                  : 'Mesurer la FC au repos'}
              </button>
            )}
            <button
              onClick={() => (sessionSetIds.length > 0 ? setAwaitingDifficulty(true) : onClose())}
              className={`mt-4 text-sm font-medium active:opacity-80 ${targetReached ? 'text-teal-400' : 'text-zinc-500'}`}
            >
              Terminer l'exercice {targetReached ? '✓' : ''}
            </button>
          </>
        ) : (
          <div className="w-full max-w-xs">
            <p className="mb-4 text-center text-sm font-medium text-zinc-300">Niveau de difficulté de l'exercice</p>
            <div className="space-y-2">
              {DIFFICULTY_LEVELS.map((lvl) => (
                <button
                  key={lvl.label}
                  onClick={() => pickDifficulty(lvl.rpe)}
                  className={`w-full rounded-xl py-3 text-sm font-semibold active:opacity-80 ${lvl.color}`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>

      {hrMeterOpen && lastLoggedSetId && (
        <HeartRateMeter
          onClose={() => setHrMeterOpen(false)}
          onMeasured={(bpm) => {
            onHeartRate(lastLoggedSetId, bpm)
            setHrMeterOpen(false)
          }}
        />
      )}
    </div>
  )
}
