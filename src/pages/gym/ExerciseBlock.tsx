import { useEffect, useState } from 'react'
import { Check, Copy, Flame, HeartPulse, Pencil, Play, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import { getLastPerformance, estimateExerciseDurationMin, type LastPerformance } from '../../lib/workouts'
import { ALL_EXERCISES } from '../../lib/exercises'
import HeartRateMeter from '../../components/HeartRateMeter'
import type { SetEntry, WorkoutExercise } from '../../types'

export function ExerciseBlock({
  we,
  onAddSet,
  onHeartRate,
  googleFitHeartRateAvg,
  restTimerDefaultSec,
  onFocus,
  onRemove,
  onEditSet,
  onDeleteSet,
}: {
  we: WorkoutExercise
  onAddSet: (set: Omit<SetEntry, 'id' | 'exerciseId' | 'completedAt' | 'isPr'>) => void
  onHeartRate: (bpm: number, source: 'camera' | 'googlefit') => void
  googleFitHeartRateAvg: number | null
  restTimerDefaultSec: number
  onFocus: () => void
  onRemove: () => void
  onEditSet: (setId: string, patch: { weightKg: number; reps: number; rpe?: number; isWarmup: boolean }) => void
  onDeleteSet: (setId: string) => void
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
  const [editRpe, setEditRpe] = useState('')
  const [editWarmup, setEditWarmup] = useState(false)

  function startEditSet(s: SetEntry) {
    setEditingSetId(s.id)
    setEditWeight(String(s.weightKg))
    setEditReps(String(s.reps))
    setEditRpe(s.rpe != null ? String(s.rpe) : '')
    setEditWarmup(s.isWarmup)
  }

  function confirmEditSet() {
    const w = parseFloat(editWeight.replace(',', '.'))
    const r = parseInt(editReps, 10)
    if (Number.isNaN(w) || w < 0 || !r || !editingSetId) return
    const rpeVal = editRpe ? parseFloat(editRpe.replace(',', '.')) : undefined
    onEditSet(editingSetId, { weightKg: w, reps: r, rpe: rpeVal != null && rpeVal > 0 ? Math.min(10, rpeVal) : undefined, isWarmup: editWarmup })
    setEditingSetId(null)
  }

  function deleteEditedSet() {
    if (!editingSetId) return
    if (!confirm('Supprimer cette série ?')) return
    onDeleteSet(editingSetId)
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
              <li key={s.id} className="space-y-1.5 rounded-lg bg-zinc-900 px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">S{i + 1}</span>
                  <input
                    inputMode="decimal"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    aria-label="Poids (kg)"
                    className="w-14 rounded-md bg-zinc-800 px-1.5 py-1.5 text-center text-xs outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <span className="text-xs text-zinc-600">kg ×</span>
                  <input
                    inputMode="numeric"
                    value={editReps}
                    onChange={(e) => setEditReps(e.target.value)}
                    aria-label="Répétitions"
                    className="w-12 rounded-md bg-zinc-800 px-1.5 py-1.5 text-center text-xs outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <input
                    inputMode="decimal"
                    value={editRpe}
                    onChange={(e) => setEditRpe(e.target.value)}
                    placeholder="RPE"
                    aria-label="RPE"
                    className="w-12 rounded-md bg-zinc-800 px-1.5 py-1.5 text-center text-xs outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditWarmup((v) => !v)}
                    aria-pressed={editWarmup}
                    className={clsx('rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase', editWarmup ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-500')}
                  >
                    Échauffement
                  </button>
                  <button onClick={deleteEditedSet} className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1.5 text-[10px] font-semibold uppercase text-red-400 active:bg-red-500/10">
                    <Trash2 size={11} /> Supprimer
                  </button>
                  <button onClick={confirmEditSet} className="ml-auto rounded-md bg-orange-500 p-1.5 text-zinc-950 active:bg-orange-400" aria-label="Valider la correction">
                    <Check size={14} strokeWidth={3} />
                  </button>
                  <button onClick={() => setEditingSetId(null)} className="rounded-md bg-zinc-800 p-1.5 text-zinc-400 active:bg-zinc-700" aria-label="Annuler">
                    <X size={14} />
                  </button>
                </div>
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
