import { getDb } from './db'
import { pullGoogleFitFromNutriTracker, refreshGoogleFitRemote } from './nutriTrackerSync'
import { todayStr } from './date'
import type { GoogleFitDay } from '../types'

/** Tire les N derniers jours Google Fit depuis NutriTracker et les met en
 * cache local (IndexedDB) — best-effort, ne bloque jamais l'UI en cas d'échec.
 * 14j par défaut (pas juste "aujourd'hui") pour que autoLogWalkFromStepsIfNeeded
 * puisse rattraper les jours où l'app n'a pas été ouverte. */
const REFRESH_KEY = 'fit2be:gfRemoteRefreshAt'
const REFRESH_MIN_GAP_MS = 5 * 60_000

export async function syncGoogleFit(days = 14, opts: { force?: boolean } = {}): Promise<void> {
  // Resynchronise d'abord chez Google (via NutriTracker) — au plus toutes les 5 min, sauf demande explicite.
  let last = 0
  try {
    last = Number(localStorage.getItem(REFRESH_KEY)) || 0
  } catch {
    // stockage indisponible : on resynchronise
  }
  if (opts.force || Date.now() - last > REFRESH_MIN_GAP_MS) {
    const ok = await refreshGoogleFitRemote(2)
    if (ok) {
      try {
        localStorage.setItem(REFRESH_KEY, String(Date.now()))
      } catch {
        // ignore
      }
    }
  }

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
        sleepSource: r.sleepSource ?? (r.sleepMinutes != null ? 'googlefit' : null),
        remoteSyncedAt: r.syncedAtMs ?? null,
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
