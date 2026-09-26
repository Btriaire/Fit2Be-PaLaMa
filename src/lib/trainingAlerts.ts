import { getAllWorkouts, getExerciseHistory } from './workouts'
import { ALL_EXERCISES } from './exercises'
import { computeAcwr, computeTrainingMonotony, type Acwr, type TrainingMonotony } from './recovery'

export interface TrainingAlert {
  id: string
  level: 'warn' | 'info'
  title: string
  detail: string
  to: string
}

/**
 * Plateau : le meilleur 1RM estimé des 3 dernières séances n'améliore pas de plus de 1 %
 * le meilleur des séances précédentes (il en faut au moins 2 avant, soit 5 séances).
 */
export function detectPlateau(e1rms: number[]): boolean {
  if (e1rms.length < 5) return false
  const recent = e1rms.slice(-3)
  const prior = e1rms.slice(0, -3)
  return Math.max(...recent) <= Math.max(...prior) * 1.01
}

/** Décharge conseillée quand la charge monte trop vite ou reste trop uniforme (Gabbett 2016 ; Foster 1998). */
export function deloadAlerts(acwr: Acwr, monotony: TrainingMonotony): TrainingAlert[] {
  const out: TrainingAlert[] = []
  if (acwr.ratio != null && acwr.ratio > 1.5) {
    out.push({
      id: 'deload-acwr',
      level: 'warn',
      title: 'Semaine de décharge conseillée',
      detail: `Ta charge des 7 derniers jours est ${acwr.ratio.toString().replace('.', ',')}× ta charge habituelle : réduis le volume de ~40 % pendant quelques jours.`,
      to: '/recovery',
    })
  } else if (acwr.ratio != null && acwr.ratio > 1.3) {
    out.push({
      id: 'load-rising',
      level: 'info',
      title: 'Ta charge monte vite',
      detail: `Charge aiguë ${acwr.ratio.toString().replace('.', ',')}× la chronique : garde une séance légère cette semaine.`,
      to: '/recovery',
    })
  }
  if (monotony.risk === 'élevé') {
    out.push({
      id: 'deload-monotony',
      level: 'warn',
      title: 'Charge trop uniforme',
      detail: 'Tes jours se ressemblent trop (monotonie élevée) : alterne jours durs, légers et repos.',
      to: '/recovery',
    })
  }
  return out
}

/** Exercices en plateau parmi ceux pratiqués régulièrement (≥ 5 séances) et récemment (≤ 21 j). */
export async function findPlateaus(maxItems = 2): Promise<TrainingAlert[]> {
  const workouts = (await getAllWorkouts()).filter((w) => w.finishedAt)
  const counts = new Map<string, number>()
  for (const w of workouts) for (const we of w.exercises) counts.set(we.exerciseId, (counts.get(we.exerciseId) ?? 0) + 1)
  const candidates = [...counts.entries()].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1])
  const alerts: TrainingAlert[] = []
  const now = Date.now()
  for (const [exerciseId] of candidates) {
    const points = (await getExerciseHistory(exerciseId)).filter((p) => p.estimated1RM > 0).sort((a, b) => a.date - b.date)
    if (points.length < 5 || now - points[points.length - 1].date > 21 * 86_400_000) continue
    if (!detectPlateau(points.slice(-6).map((p) => p.estimated1RM))) continue
    const name = ALL_EXERCISES.find((e) => e.id === exerciseId)?.name ?? exerciseId
    alerts.push({
      id: `plateau-${exerciseId}`,
      level: 'info',
      title: `Plateau : ${name}`,
      detail: '3 séances sans progrès du 1RM estimé. Change la fourchette de reps, ajoute une série ou fais une semaine de décharge.',
      to: `/gym/exercise/${exerciseId}`,
    })
    if (alerts.length >= maxItems) break
  }
  return alerts
}

export async function computeTrainingAlerts(ageYears: number): Promise<TrainingAlert[]> {
  const [acwr, monotony, plateaus] = await Promise.all([computeAcwr(ageYears), computeTrainingMonotony(ageYears), findPlateaus()])
  return [...deloadAlerts(acwr, monotony), ...plateaus]
}
