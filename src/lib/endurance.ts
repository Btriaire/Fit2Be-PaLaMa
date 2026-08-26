import { getDb, newId } from './db'
import { computeCaloriesForUser } from './met'
import { computeHrZone } from './heartRate'
import type { Settings } from './settings'
import type { EnduranceActivityType, EnduranceSession } from '../types'

export const ENDURANCE_ACTIVITY_META: Record<EnduranceActivityType, { label: string; met: number; hasDistance: boolean }> = {
  course: { label: 'Course à pied', met: 9.8, hasDistance: true },
  velo: { label: 'Vélo (route)', met: 8, hasDistance: true },
  natation: { label: 'Natation', met: 7, hasDistance: true },
  rameur: { label: 'Rameur', met: 7, hasDistance: false },
  'velo-appart': { label: "Vélo d'appartement", met: 6.8, hasDistance: false },
  tapis: { label: 'Tapis de course', met: 8.3, hasDistance: true },
  marche: { label: 'Marche', met: 4.3, hasDistance: true },
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
  }
  const db = await getDb()
  await db.put('endurance', session)
  return session
}

export async function deleteEnduranceSession(id: string) {
  const db = await getDb()
  await db.delete('endurance', id)
}
