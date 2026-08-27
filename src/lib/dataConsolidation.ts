// Détection/suppression des doublons stricts créés par un double-tap sur
// "Enregistrer" : même série/activité/repas, mêmes valeurs, logué à la même
// minute. Ne touche jamais deux entrées légitimement identiques loguées à
// des moments différents (ex: deux vraies séries à 80kg × 10).

import { getDb } from './db'
import { pushRecord, deleteRecord } from './cloudSync'

function minuteBucket(ts: number) {
  return Math.floor(ts / 60000)
}

export interface ConsolidationResult {
  setsRemoved: number
  activitiesRemoved: number
  nutritionRemoved: number
  recoveryRemoved: number
}

export const EMPTY_CONSOLIDATION: ConsolidationResult = {
  setsRemoved: 0,
  activitiesRemoved: 0,
  nutritionRemoved: 0,
  recoveryRemoved: 0,
}

/** `apply: false` = juste compter (aperçu) ; `apply: true` = supprime réellement les doublons. */
export async function consolidateData(apply: boolean): Promise<ConsolidationResult> {
  const db = await getDb()
  const result: ConsolidationResult = { ...EMPTY_CONSOLIDATION }

  const workouts = await db.getAll('workouts')
  for (const w of workouts) {
    let changed = false
    for (const we of w.exercises) {
      const seen = new Set<string>()
      const kept = []
      for (const s of we.sets) {
        const key = `${s.weightKg}|${s.reps}|${s.rpe ?? ''}|${s.isWarmup}|${minuteBucket(s.completedAt)}`
        if (seen.has(key)) {
          result.setsRemoved++
          changed = true
          continue
        }
        seen.add(key)
        kept.push(s)
      }
      we.sets = kept
    }
    if (changed && apply) {
      await db.put('workouts', w)
      pushRecord('workouts', w.id, w)
    }
  }

  const activities = await db.getAll('activities')
  const activitySeen = new Set<string>()
  for (const a of activities) {
    const key = `${a.label}|${a.durationMin}|${a.caloriesBurned}|${minuteBucket(a.loggedAt)}`
    if (activitySeen.has(key)) {
      result.activitiesRemoved++
      if (apply) {
        await db.delete('activities', a.id)
        deleteRecord('activities', a.id)
      }
    } else {
      activitySeen.add(key)
    }
  }

  const nutrition = await db.getAll('nutrition')
  const nutritionSeen = new Set<string>()
  for (const n of nutrition) {
    const key = `${n.label}|${n.calories}|${minuteBucket(n.loggedAt)}`
    if (nutritionSeen.has(key)) {
      result.nutritionRemoved++
      if (apply) {
        await db.delete('nutrition', n.id)
        deleteRecord('nutrition', n.id)
      }
    } else {
      nutritionSeen.add(key)
    }
  }

  // Un check-in de récupération est censé être unique par jour (la date
  // n'est qu'un index, pas une clé unique en base) — deux entrées pour la
  // même date sont toujours un doublon, jamais une coïncidence légitime.
  const recovery = await db.getAll('recovery')
  const recoverySeen = new Set<string>()
  for (const r of recovery) {
    if (recoverySeen.has(r.date)) {
      result.recoveryRemoved++
      if (apply) {
        await db.delete('recovery', r.id)
        deleteRecord('recovery', r.id)
      }
    } else {
      recoverySeen.add(r.date)
    }
  }

  return result
}

export function totalDuplicates(r: ConsolidationResult): number {
  return r.setsRemoved + r.activitiesRemoved + r.nutritionRemoved + r.recoveryRemoved
}
