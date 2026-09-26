import { useEffect, useState } from 'react'
import { HeartPulse, Trash2, X } from 'lucide-react'
import { getLastPerformance, type LastPerformance } from '../../lib/workouts'
import { ALL_EXERCISES } from '../../lib/exercises'
import { getSettings } from '../../lib/settings'
import { playMotivation } from '../../lib/motivationVoice'
import HeartRateMeter from '../../components/HeartRateMeter'
import type { SetEntry, WorkoutExercise } from '../../types'
import { DIFFICULTY_LEVELS } from './difficulty'

// Vue plein écran isolée sur un seul exercice — demande le "niveau de
// difficulté" après chaque série plutôt qu'un champ RPE optionnel qu'on
// oublie de remplir, pour que la charge réelle remonte fiablement vers
// Progression et Récupération (méthode session-RPE, voir lib/recovery.ts).
export function FocusExerciseView({
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
      <div className="flex min-h-full flex-col items-center px-6 py-4">
        <div className="mb-3 flex w-full max-w-xs items-center gap-3">
          {exercise?.images?.[0] && (
            <img src={exercise.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-zinc-900 object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-400">
              Série <span className="font-mono text-zinc-200">{doneCount + 1}</span>
              {we.targetSets != null && <span> / {we.targetSets}</span>}
            </p>
            {we.targetSets != null && we.targetSets > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {Array.from({ length: Math.max(we.targetSets, doneCount) }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full ${i < doneCount ? 'bg-orange-500' : 'bg-zinc-800'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        {last && we.sets.length === 0 && (
          <p className="mb-3 w-full max-w-xs text-xs text-zinc-600">
            Dernière fois : {last.weightKg}kg × {last.reps}
          </p>
        )}

        {!awaitingDifficulty ? (
          <>
            <div className="mb-4 flex items-center gap-4">
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
              className={`mt-3 text-sm font-medium active:opacity-80 ${targetReached ? 'text-teal-400' : 'text-zinc-500'}`}
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
