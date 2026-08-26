import { getDb, newId } from './db'
import { computeCaloriesForUser } from './met'
import { computeHrZone } from './heartRate'
import { pushActivityToNutriTracker } from './nutriTrackerSync'
import type { Settings } from './settings'
import type { EnduranceActivityType, EnduranceSession, RoutePoint } from '../types'

// googleFitType : code d'activité Google Fit repris par NutriTracker Palama
// (app/api/activity/route.ts) pour dénormaliser un nom d'activité côté sync.
export const ENDURANCE_ACTIVITY_META: Record<
  EnduranceActivityType,
  { label: string; met: number; hasDistance: boolean; googleFitType: number }
> = {
  course: { label: 'Course à pied', met: 9.8, hasDistance: true, googleFitType: 1 },
  velo: { label: 'Vélo (route)', met: 8, hasDistance: true, googleFitType: 7 },
  natation: { label: 'Natation', met: 7, hasDistance: true, googleFitType: 93 },
  rameur: { label: 'Rameur', met: 7, hasDistance: false, googleFitType: 37 },
  'velo-appart': { label: "Vélo d'appartement", met: 6.8, hasDistance: false, googleFitType: 8 },
  tapis: { label: 'Tapis de course', met: 8.3, hasDistance: true, googleFitType: 3 },
  marche: { label: 'Marche', met: 4.3, hasDistance: true, googleFitType: 46 },
}

export function computePaceMinPerKm(durationMin: number, distanceKm: number): number | null {
  if (!distanceKm || distanceKm <= 0) return null
  return durationMin / distanceKm
}

export function formatPace(paceMinPerKm: number): string {
  const min = Math.floor(paceMinPerKm)
  const sec = Math.round((paceMinPerKm - min) * 60)
  return `${min}:${String(sec).padStart(2, '0')}/km`
}

export async function getEnduranceSessions(): Promise<EnduranceSession[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('endurance', 'byStartedAt')
  return all.reverse()
}

export async function logEnduranceSession(
  input: {
    activityType: EnduranceActivityType
    durationMin: number
    distanceKm?: number
    avgHeartRate?: number
    startedAt?: number
    route?: RoutePoint[]
  },
  settings: Settings,
): Promise<EnduranceSession> {
  const meta = ENDURANCE_ACTIVITY_META[input.activityType]
  const caloriesBurned = computeCaloriesForUser(meta.met, input.durationMin, settings)
  const hrZone = input.avgHeartRate ? computeHrZone(input.avgHeartRate, settings.ageYears) : undefined
  const session: EnduranceSession = {
    id: newId(),
    activityType: input.activityType,
    startedAt: input.startedAt ?? Date.now(),
    durationMin: input.durationMin,
    distanceKm: input.distanceKm,
    avgHeartRate: input.avgHeartRate,
    hrZone,
    caloriesBurned,
    ...(input.route && input.route.length > 0 ? { route: input.route } : {}),
  }
  const db = await getDb()
  await db.put('endurance', session)

  void pushActivityToNutriTracker({
    name: meta.label,
    activityType: meta.googleFitType,
    durationMin: input.durationMin,
    caloriesBurned,
    date: new Date(session.startedAt).toISOString().slice(0, 10),
  })

  return session
}

export async function deleteEnduranceSession(id: string) {
  const db = await getDb()
  await db.delete('endurance', id)
}

export interface EnduranceHistoryPoint {
  date: number
  distanceKm?: number
  paceMinPerKm: number | null
  durationMin: number
  avgHeartRate?: number
}

/** Historique chronologique des sorties pour un type d'activité donné. */
export async function getEnduranceHistory(activityType: EnduranceActivityType): Promise<EnduranceHistoryPoint[]> {
  const sessions = await getEnduranceSessions()
  return sessions
    .filter((s) => s.activityType === activityType)
    .reverse()
    .map((s) => ({
      date: s.startedAt,
      distanceKm: s.distanceKm,
      paceMinPerKm: s.distanceKm ? computePaceMinPerKm(s.durationMin, s.distanceKm) : null,
      durationMin: s.durationMin,
      avgHeartRate: s.avgHeartRate,
    }))
}

/** Types d'activité déjà pratiqués au moins une fois, avec leur dernière date. */
export async function getLoggedActivityTypes(): Promise<Array<{ activityType: EnduranceActivityType; lastDate: number }>> {
  const sessions = await getEnduranceSessions()
  const map = new Map<EnduranceActivityType, number>()
  for (const s of sessions) {
    const prev = map.get(s.activityType) ?? 0
    if (s.startedAt > prev) map.set(s.activityType, s.startedAt)
  }
  return Array.from(map.entries())
    .map(([activityType, lastDate]) => ({ activityType, lastDate }))
    .sort((a, b) => b.lastDate - a.lastDate)
}
