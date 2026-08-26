import { getDb } from './db'
import { pullGoogleFitFromNutriTracker } from './nutriTrackerSync'
import { todayStr } from './date'
import type { GoogleFitDay } from '../types'

/** Tire les N derniers jours Google Fit depuis NutriTracker et les met en
 * cache local (IndexedDB) — best-effort, ne bloque jamais l'UI en cas d'échec. */
export async function syncGoogleFit(days = 7): Promise<void> {
  const rows = await pullGoogleFitFromNutriTracker(days)
  if (rows.length === 0) return
  const db = await getDb()
  const tx = db.transaction('googleFitDaily', 'readwrite')
  await Promise.all(
    rows.map((r) =>
      tx.store.put({
        date: r.date,
        steps: r.steps,
        activeCaloriesBurned: r.activeCaloriesBurned,
        activeMinutes: r.activeMinutes,
        heartRateAvg: r.heartRateAvg,
        sleepMinutes: r.sleepMinutes,
        syncedAt: Date.now(),
      } satisfies GoogleFitDay),
    ),
  )
  await tx.done
}

export async function getTodayGoogleFit(): Promise<GoogleFitDay | null> {
  const db = await getDb()
  return (await db.get('googleFitDaily', todayStr())) ?? null
}

export async function getGoogleFitForDate(dateStr: string): Promise<GoogleFitDay | null> {
  const db = await getDb()
  return (await db.get('googleFitDaily', dateStr)) ?? null
}

export async function getGoogleFitDays(days = 7): Promise<GoogleFitDay[]> {
  const db = await getDb()
  const all = await db.getAll('googleFitDaily')
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, days)
}
