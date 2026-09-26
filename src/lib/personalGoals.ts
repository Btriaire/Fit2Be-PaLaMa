import { getDb } from './db'
import { getGoogleFitDays } from './googleFit'
import { getAllWorkouts } from './workouts'

export const DEFAULT_STEPS_GOAL = 8000
export const DEFAULT_SESSIONS_GOAL = 4

export interface PersonalGoals {
  steps: number
  sessions: number
  /** Vrai quand au moins un objectif est calibré sur l'historique (sinon valeurs génériques). */
  adapted: boolean
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Un cran au-dessus de la médiane des pas habituels (+10 %), arrondi à 500, borné 6 000-12 000. */
export function stepsGoalFromHistory(dailySteps: number[]): number | null {
  const days = dailySteps.filter((s) => s > 0)
  if (days.length < 7) return null
  const goal = Math.round((median(days) * 1.1) / 500) * 500
  return Math.max(6000, Math.min(12_000, goal))
}

/** Moyenne des séances par semaine sur les semaines récentes, +0,5 séance, bornée 2-6. */
export function sessionsGoalFromWeeks(weeklyCounts: number[]): number | null {
  if (weeklyCounts.length < 2 || weeklyCounts.every((c) => c === 0)) return null
  const mean = weeklyCounts.reduce((a, b) => a + b, 0) / weeklyCounts.length
  return Math.max(2, Math.min(6, Math.round(mean + 0.5)))
}

export async function computePersonalGoals(now = Date.now()): Promise<PersonalGoals> {
  const fit = await getGoogleFitDays(28)
  const steps = stepsGoalFromHistory(fit.map((d) => d.steps))

  const db = await getDb()
  const [workouts, endurance] = await Promise.all([getAllWorkouts(), db.getAll('endurance')])
  const stamps = [
    ...workouts.filter((w) => w.finishedAt).map((w) => w.startedAt),
    ...endurance.filter((e) => !e.id.startsWith('steps-')).map((e) => e.startedAt),
  ]
  const weeks = [0, 1, 2, 3].map((i) => {
    const end = now - i * 7 * 86_400_000
    return stamps.filter((t) => t <= end && t > end - 7 * 86_400_000).length
  })
  const sessions = stamps.some((t) => t <= now - 14 * 86_400_000) ? sessionsGoalFromWeeks(weeks) : null

  return {
    steps: steps ?? DEFAULT_STEPS_GOAL,
    sessions: sessions ?? DEFAULT_SESSIONS_GOAL,
    adapted: steps != null || sessions != null,
  }
}
