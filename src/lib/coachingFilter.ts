// Filtre "état de forme + temps dispo" partagé par les deux listes coaching
// (Gym et Endurance) — pose les deux questions avant de proposer un
// programme plutôt que de laisser l'utilisateur chercher dans une longue
// liste, et évite de proposer une séance de 45 min à quelqu'un qui a 15 min.

export type Readiness = 'fatigue' | 'normal' | 'forme'
export type TimeBudget = 15 | 30 | 45 | 60 | 999

export const READINESS_OPTIONS: { value: Readiness; label: string }[] = [
  { value: 'fatigue', label: 'Fatigué' },
  { value: 'normal', label: 'Normal' },
  { value: 'forme', label: 'En forme' },
]

export const TIME_BUDGET_OPTIONS: { value: TimeBudget; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 999, label: '60+ min' },
]

export type CoachingDifficulty = 'facile' | 'modéré' | 'dur'

const DIFFICULTY_RANK: Record<CoachingDifficulty, number> = { facile: 0, modéré: 1, dur: 2 }
const READINESS_MAX_DIFFICULTY: Record<Readiness, number> = { fatigue: 0, normal: 1, forme: 2 }

/** Une séance dont la durée dépasse le budget de quelques minutes reste
 * proposée (mieux vaut la finir un peu en avance que l'exclure pour 2 min) —
 * seul le bucket "60+ min" est un vrai minimum, pas une tolérance. */
export function fitsTimeBudget(durationMin: number, budget: TimeBudget): boolean {
  if (budget === 999) return durationMin > 60
  return durationMin <= budget + 5
}

/** Score de pertinence pour trier la liste — un programme dont la difficulté
 * dépasse l'état de forme du jour descend en fin de liste plutôt que d'être
 * masqué (l'utilisateur peut quand même vouloir se pousser un peu). */
export function readinessMatchScore(difficulty: CoachingDifficulty | undefined, readiness: Readiness): number {
  if (!difficulty) return 1
  return DIFFICULTY_RANK[difficulty] <= READINESS_MAX_DIFFICULTY[readiness] ? 0 : 1
}
