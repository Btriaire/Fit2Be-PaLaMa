import { computeBmr } from './met'
import type { Goal, Settings } from './settings'

export interface CalorieTarget {
  bmr: number
  /** Dépense hors sport : BMR + effet thermique des aliments + activité de base non loguée. */
  baseline: number
  /** Écart appliqué selon l'objectif (négatif = déficit). */
  adjustment: number
  target: number
  mode: 'auto' | 'manual'
}

/** Facteur sédentaire (~10 % d'effet thermique des aliments + ~5 % d'activité de base). Le sport loggué s'ajoute jour par jour. */
export const BASELINE_FACTOR = 1.15

const FLOOR: Record<Settings['sex'], number> = { homme: 1500, femme: 1200 }

export function adjustmentFor(goal: Goal, baseline: number): number {
  if (goal === 'perte') return -Math.round(Math.max(300, Math.min(600, baseline * 0.2)))
  if (goal === 'prise') return Math.round(Math.max(200, Math.min(400, baseline * 0.1)))
  return 0
}

export function targetFromProfile(settings: Settings): CalorieTarget {
  const bmr = computeBmr(settings)
  const baseline = Math.round(bmr * BASELINE_FACTOR)
  const adjustment = adjustmentFor(settings.goal, baseline)
  const target = Math.max(FLOOR[settings.sex], baseline + adjustment)
  return { bmr, baseline, adjustment: target - baseline, target, mode: 'auto' }
}

/** Cible effective : calculée (mode auto) ou saisie (mode manuel). */
export function effectiveCalorieTarget(settings: Settings): CalorieTarget {
  if (settings.calorieMode === 'auto') return targetFromProfile(settings)
  const bmr = computeBmr(settings)
  return { bmr, baseline: Math.round(bmr * BASELINE_FACTOR), adjustment: 0, target: settings.dailyCalorieTarget, mode: 'manual' }
}
