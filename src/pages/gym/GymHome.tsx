import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, ChevronRight, ChevronDown, Flame, TrendingUp, Trash2, Target, X, Check, Bookmark } from 'lucide-react'
import { getAllWorkouts, saveWorkout, deleteWorkout, getLoggedExerciseIds, estimateWorkoutCalories } from '../../lib/workouts'
import { newId } from '../../lib/db'
import { formatDate, formatTime } from '../../lib/date'
import { ALL_EXERCISES } from '../../lib/exercises'
import { TRAINING_TEMPLATES, COACHING_TEMPLATES, type TrainingTemplate } from '../../lib/trainingTemplates'
import { getCustomTemplates, deleteCustomTemplate } from '../../lib/customTemplates'
import { getLastExclusions, saveLastExclusions } from '../../lib/templateExclusions'
import { getSettings } from '../../lib/settings'
import { fitsTimeBudget, readinessMatchScore, type Readiness, type TimeBudget } from '../../lib/coachingFilter'
import { useCollapsible } from '../../lib/useCollapsible'
import CoachingQuestions from '../../components/CoachingQuestions'
import Collapsible from '../../components/Collapsible'
import ActivityHero from '../../components/ActivityHero'
import BackButton from '../../components/BackButton'
import type { CustomTemplate, Workout, WorkoutExercise } from '../../types'

const QUICK_NAMES = ['Push Day', 'Pull Day', 'Leg Day', 'Full Body', 'Haut du corps', 'Bas du corps']

export default function GymHome() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedExercises, setLoggedExercises] = useState<Array<{ exerciseId: string; lastDate: number }>>([])
  const [previewTemplate, setPreviewTemplate] = useState<TrainingTemplate | null>(null)
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [previewCustom, setPreviewCustom] = useState<CustomTemplate | null>(null)
  const [coachingOpen, setCoachingOpen] = useCollapsible('gym-coaching')
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [timeBudget, setTimeBudget] = useState<TimeBudget | null>(null)
  const [templatesOpen, setTemplatesOpen] = useCollapsible('gym-templates')

  function refreshCustomTemplates() {
    getCustomTemplates().then(setCustomTemplates)
  }

  useEffect(() => {
    getAllWorkouts().then((w) => {
      setWorkouts(w)
      setLoading(false)
    })
    getLoggedExerciseIds().then(setLoggedExercises)
    refreshCustomTemplates()
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

  const visibleCoachingTemplates = COACHING_TEMPLATES.filter(
    (tpl) => timeBudget == null || tpl.estimatedMin == null || fitsTimeBudget(tpl.estimatedMin, timeBudget),
  ).sort((a, b) => (readiness ? readinessMatchScore(a.difficulty, readiness) - readinessMatchScore(b.difficulty, readiness) : 0))

  async function startFromTemplate(tpl: TrainingTemplate, excludedIds: Set<string>) {
    const exercises: WorkoutExercise[] = tpl.exercises
      .filter((te) => !excludedIds.has(te.exerciseId))
      .map((te, order) => ({
        exerciseId: te.exerciseId,
        order,
        sets: [],
        targetSets: te.targetSets,
        targetReps: te.targetReps,
        note: te.note,
      }))
    const workout: Workout = { id: newId(), name: tpl.name, startedAt: Date.now(), exercises, templateId: tpl.id }
    await saveWorkout(workout)
    setPreviewTemplate(null)
    navigate(`/gym/workout/${workout.id}`)
  }

  async function startFromCustomTemplate(tpl: CustomTemplate, excludedIds: Set<string>) {
    const exercises: WorkoutExercise[] = tpl.exercises
      .filter((te) => !excludedIds.has(te.exerciseId))
      .map((te, order) => ({ exerciseId: te.exerciseId, order, sets: [], targetSets: te.targetSets, targetReps: te.targetReps }))
    const workout: Workout = { id: newId(), name: tpl.name, startedAt: Date.now(), exercises }
    await saveWorkout(workout)
    setPreviewCustom(null)
    navigate(`/gym/workout/${workout.id}`)
  }

  async function removeCustomTemplate(id: string, name: string) {
    if (!confirm(`Supprimer le modèle "${name}" ?`)) return
    await deleteCustomTemplate(id)
    setPreviewCustom(null)
    refreshCustomTemplates()
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
          <BackButton />
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
        <button
          onClick={() => setCoachingOpen((v) => !v)}
          className="mb-2 flex w-full items-center justify-between text-sm font-medium text-zinc-400"
        >
          <span className="flex items-center gap-1.5">
            <Flame size={14} className="text-teal-400" /> Séances Coaching — cardio & muscu
          </span>
          <ChevronDown size={16} className={`text-zinc-600 transition-transform ${coachingOpen ? 'rotate-180' : ''}`} />
        </button>
        <Collapsible open={coachingOpen}>
          <CoachingQuestions
            readiness={readiness}
            onReadiness={setReadiness}
            timeBudget={timeBudget}
            onTimeBudget={setTimeBudget}
            accentClass="bg-teal-500"
          />
          <div className="space-y-1.5">
            {visibleCoachingTemplates.length === 0 && (
              <p className="text-xs text-zinc-600">Aucune séance ne rentre dans ce temps — essaie un budget plus large.</p>
            )}
            {visibleCoachingTemplates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setPreviewTemplate(tpl)}
                className="glass flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left active:scale-[0.98] transition-transform"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-500/15 text-teal-400">
                  <Flame size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{tpl.name}</p>
                  <p className="truncate text-[11px] leading-tight text-zinc-500">
                    {tpl.focus}
                    {tpl.estimatedMin != null ? ` · ~${tpl.estimatedMin} min` : ''}
                  </p>
                </div>
                <ChevronRight size={14} className="shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
        </Collapsible>
      </section>

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
        <button
          onClick={() => setTemplatesOpen((v) => !v)}
          className="mb-2 flex w-full items-center justify-between text-sm font-medium text-zinc-400"
        >
          <span>Templates par chef musculaire</span>
          <ChevronDown size={16} className={`text-zinc-600 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} />
        </button>
        <Collapsible open={templatesOpen}>
          <div className="space-y-1.5">
            {TRAINING_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setPreviewTemplate(tpl)}
                className="glass flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left active:scale-[0.98] transition-transform"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">
                  <Target size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{tpl.name}</p>
                  <p className="truncate text-[11px] leading-tight text-zinc-500">{tpl.focus}</p>
                </div>
                <ChevronRight size={14} className="shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
        </Collapsible>
      </section>

      {customTemplates.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">Mes modèles</h2>
          <div className="space-y-2">
            {customTemplates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setPreviewCustom(tpl)}
                className="glass flex w-full items-center gap-3 rounded-xl p-3.5 text-left active:scale-[0.98] transition-transform"
              >
                {tpl.photoDataUrl ? (
                  <img src={tpl.photoDataUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
                    <Bookmark size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{tpl.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {tpl.exercises.length} exercice{tpl.exercises.length > 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
        </section>
      )}

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
          onStart={(excludedIds) => startFromTemplate(previewTemplate, excludedIds)}
        />
      )}

      {previewCustom && (
        <CustomTemplatePreview
          template={previewCustom}
          onClose={() => setPreviewCustom(null)}
          onStart={(excludedIds) => startFromCustomTemplate(previewCustom, excludedIds)}
          onDelete={() => removeCustomTemplate(previewCustom.id, previewCustom.name)}
        />
      )}
    </div>
  )
}

function CustomTemplatePreview({
  template,
  onClose,
  onStart,
  onDelete,
}: {
  template: CustomTemplate
  onClose: () => void
  onStart: (excludedIds: Set<string>) => void
  onDelete: () => void
}) {
  const [excluded, setExcluded] = useState<Set<string>>(() => {
    // Ne garde que les exclusions qui correspondent encore à un exercice du
    // template (il peut avoir changé depuis) — sinon un id périmé ne ferait
    // simplement rien, sans casser l'affichage.
    const saved = getLastExclusions(template.id)
    const validIds = new Set(template.exercises.map((te) => te.exerciseId))
    return new Set([...saved].filter((id) => validIds.has(id)))
  })
  const selectedCount = template.exercises.length - excluded.size

  function toggle(exerciseId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      saveLastExclusions(template.id, next)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center gap-3">
            {template.photoDataUrl ? (
              <img src={template.photoDataUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                <Bookmark size={22} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{template.name}</h2>
              <p className="text-xs text-zinc-500">
                {template.exercises.length} exercice{template.exercises.length > 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
          <p className="mb-2 text-[11px] text-zinc-600">Décoche ce que tu ne veux pas faire aujourd'hui.</p>

          <ul className="space-y-2.5">
            {template.exercises.map((te) => {
              const ex = ALL_EXERCISES.find((e) => e.id === te.exerciseId)
              const isExcluded = excluded.has(te.exerciseId)
              return (
                <li key={te.exerciseId}>
                  <button
                    onClick={() => toggle(te.exerciseId)}
                    className={`glass flex w-full items-center gap-2.5 rounded-xl p-3 text-left transition-opacity ${isExcluded ? 'opacity-40' : ''}`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                        isExcluded ? 'border-zinc-700 bg-transparent' : 'border-orange-500 bg-orange-500'
                      }`}
                    >
                      {!isExcluded && <Check size={13} strokeWidth={3} className="text-zinc-950" />}
                    </span>
                    {ex?.images?.[0] ? (
                      <img src={ex.images[0]} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-zinc-900 object-cover" />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-900" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ex?.name ?? te.exerciseId}</p>
                      <p className="text-[11px] text-zinc-500">
                        {ex?.muscleGroup} · {ex?.equipment}
                        {te.targetSets && te.targetReps ? ` · cible ${te.targetSets}×${te.targetReps}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          <button onClick={onDelete} className="mt-4 flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-red-400/80 active:text-red-400">
            <Trash2 size={12} /> Supprimer ce modèle
          </button>
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={() => onStart(excluded)}
            disabled={selectedCount === 0}
            className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-zinc-950 active:bg-indigo-400 disabled:opacity-40"
          >
            {selectedCount === 0 ? 'Sélectionne au moins un exercice' : `Démarrer cette séance (${selectedCount})`}
          </button>
        </div>
      </div>
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
  onStart: (excludedIds: Set<string>) => void
}) {
  const [excluded, setExcluded] = useState<Set<string>>(() => {
    const saved = getLastExclusions(template.id)
    const validIds = new Set(template.exercises.map((te) => te.exerciseId))
    return new Set([...saved].filter((id) => validIds.has(id)))
  })
  const selectedCount = template.exercises.length - excluded.size
  const [history, setHistory] = useState<Array<{ workout: Workout; kcal: number }>>([])

  useEffect(() => {
    const settings = getSettings()
    getAllWorkouts().then((all) =>
      setHistory(
        all
          .filter((w) => w.templateId === template.id && w.finishedAt)
          .slice(0, 5)
          .map((w) => ({ workout: w, kcal: estimateWorkoutCalories(w, settings) })),
      ),
    )
  }, [template.id])

  function toggle(exerciseId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      saveLastExclusions(template.id, next)
      return next
    })
  }

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
          <p className="mb-3 text-sm text-zinc-400">{template.description}</p>

          {template.cardioBlock && (
            <div className="mb-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-400">
                <Flame size={13} /> {template.cardioBlock.label}
              </p>
              <p className="text-xs leading-relaxed text-zinc-400">{template.cardioBlock.description}</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300">
                <TrendingUp size={13} /> Progression sur ce programme
              </p>
              <ul className="space-y-1">
                {history.map(({ workout, kcal }) => (
                  <li key={workout.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{formatDate(workout.startedAt)}</span>
                    <span className="font-mono text-zinc-500">{kcal} kcal</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mb-2 text-[11px] text-zinc-600">Décoche ce que tu ne veux pas faire aujourd'hui.</p>

          <ul className="space-y-2.5">
            {template.exercises.map((te) => {
              const ex = ALL_EXERCISES.find((e) => e.id === te.exerciseId)
              const isExcluded = excluded.has(te.exerciseId)
              return (
                <li key={te.exerciseId}>
                  <button
                    onClick={() => toggle(te.exerciseId)}
                    className={`glass flex w-full items-start gap-2.5 rounded-xl p-3 text-left transition-opacity ${isExcluded ? 'opacity-40' : ''}`}
                  >
                    <span
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                        isExcluded ? 'border-zinc-700 bg-transparent' : 'border-orange-500 bg-orange-500'
                      }`}
                    >
                      {!isExcluded && <Check size={13} strokeWidth={3} className="text-zinc-950" />}
                    </span>
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
                  </button>
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
            onClick={() => onStart(excluded)}
            disabled={selectedCount === 0}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-zinc-950 active:bg-orange-400 disabled:opacity-40"
          >
            {selectedCount === 0 ? 'Sélectionne au moins un exercice' : `Démarrer cette séance (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  )
}
