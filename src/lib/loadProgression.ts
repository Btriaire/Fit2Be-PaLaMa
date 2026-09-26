import { getAllWorkouts } from './workouts'

// Double progression : on monte les reps dans la fourchette visée, puis, quand
// toutes les séries de travail atteignent le haut de la fourchette, on ajoute de
// la charge et on repart du bas. Le RPE saisi tempère la décision (Helms et al.,
// RPE/RIR-based autoregulation, 2016 ; ACSM Position Stand, 2009).

export interface SessionSets {
  date: number
  sets: Array<{ weightKg: number; reps: number; rpe?: number }>
}

export type SuggestionKind = 'increase' | 'add-rep' | 'hold' | 'deload'

export interface LoadSuggestion {
  weightKg: number
  reps: number
  kind: SuggestionKind
  reason: string
}

export interface SuggestOptions {
  /** Fourchette prescrite par le template : "8-10", "12"... */
  targetReps?: string
  equipment?: string
}

export function parseRepRange(target?: string): { lo: number; hi: number } {
  const nums = target?.match(/\d+/g)?.map(Number) ?? []
  if (nums.length >= 2) return { lo: Math.min(nums[0], nums[1]), hi: Math.max(nums[0], nums[1]) }
  if (nums.length === 1) return { lo: nums[0], hi: nums[0] + 2 }
  return { lo: 8, hi: 12 }
}

/** Plus petit incrément de charge réaliste selon le matériel (0 = poids du corps : on ajoute des reps). */
export function incrementFor(equipment?: string): number {
  const e = (equipment ?? '').toLowerCase()
  // Le catalogue mélange libellés français (Haltères, Poids du corps) et anglais.
  if (e.includes('body') || e.includes('poids du corps') || e.includes('élastique') || e.includes('elastique')) return 0
  if (e.includes('dumbbell') || e.includes('halt') || e.includes('kettlebell')) return 2
  return 2.5
}

function roundTo(x: number, step: number): number {
  return step > 0 ? Math.round(x / step) * step : x
}

function fmt(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace('.', ',')
}

/**
 * Prochaine charge et reps pour un exercice, à partir des séances passées
 * (`history[0]` = la plus récente ; échauffements déjà exclus). Renvoie null sans historique.
 */
export function suggestNextLoad(history: SessionSets[], opts: SuggestOptions = {}): LoadSuggestion | null {
  const last = history[0]
  if (!last || last.sets.length === 0) return null
  const { lo, hi } = parseRepRange(opts.targetReps)
  const inc = incrementFor(opts.equipment)

  const w = Math.max(...last.sets.map((s) => s.weightKg))
  const atW = last.sets.filter((s) => s.weightKg === w)
  const minReps = Math.min(...atW.map((s) => s.reps))
  const rpes = atW.map((s) => s.rpe).filter((r): r is number => r != null)
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null

  // Échec répété : deux séances de suite sous le bas de la fourchette à cette charge -> on redescend.
  const prev = history[1]
  if (prev && inc > 0) {
    const prevW = Math.max(...prev.sets.map((s) => s.weightKg))
    const prevMin = Math.min(...prev.sets.filter((s) => s.weightKg === prevW).map((s) => s.reps))
    if (minReps < lo && prevMin < lo && Math.abs(prevW - w) <= inc) {
      const down = Math.max(inc, roundTo(w * 0.9, inc))
      return { weightKg: down, reps: hi, kind: 'deload', reason: `Deux séances sous ${lo} reps à ${fmt(w)} kg : redescends à ${fmt(down)} kg et reconstruis.` }
    }
  }

  const allHitTop = atW.length >= 2 && atW.every((s) => s.reps >= hi)
  if (allHitTop && (avgRpe == null || avgRpe <= 9)) {
    if (inc === 0) return { weightKg: w, reps: minReps + 1, kind: 'add-rep', reason: `Toutes tes séries à ${hi} reps : vise ${minReps + 1} reps (poids du corps).` }
    return { weightKg: w + inc, reps: lo, kind: 'increase', reason: `Toutes tes séries à ${hi} reps : +${fmt(inc)} kg et repars à ${lo}.` }
  }
  if (avgRpe != null && avgRpe >= 9.5) {
    return { weightKg: w, reps: Math.max(minReps, lo), kind: 'hold', reason: `Effort très élevé (RPE ${fmt(avgRpe)}) : garde ${fmt(w)} kg avant de monter.` }
  }
  if (minReps < lo) {
    return { weightKg: w, reps: lo, kind: 'hold', reason: `Vise au moins ${lo} reps sur chaque série à ${fmt(w)} kg avant d'augmenter.` }
  }
  const target = Math.min(hi, minReps + 1)
  return { weightKg: w, reps: target, kind: 'add-rep', reason: `Même charge, ajoute 1 rep : vise ${target} reps sur chaque série.` }
}

/** Séances terminées où l'exercice a été fait (séries de travail seulement), de la plus récente à la plus ancienne. */
export async function getExerciseSessions(exerciseId: string, limit = 3): Promise<SessionSets[]> {
  const workouts = (await getAllWorkouts()).filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt)
  const out: SessionSets[] = []
  for (const w of workouts) {
    const we = w.exercises.find((e) => e.exerciseId === exerciseId)
    const sets = (we?.sets ?? []).filter((s) => !s.isWarmup && s.reps > 0).map((s) => ({ weightKg: s.weightKg, reps: s.reps, rpe: s.rpe }))
    if (sets.length) out.push({ date: w.startedAt, sets })
    if (out.length >= limit) break
  }
  return out
}

export async function getLoadSuggestion(exerciseId: string, opts: SuggestOptions = {}): Promise<LoadSuggestion | null> {
  return suggestNextLoad(await getExerciseSessions(exerciseId, 2), opts)
}
