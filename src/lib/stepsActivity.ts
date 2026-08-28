// Log automatiquement une "Marche" dans l'historique dès que le nombre de pas
// du jour dépasse un seuil significatif — même si NutriTracker n'a pas encore
// remonté cette séance comme activité explicite (le flux d'activités
// NutriTracker/Google Fit a parfois plusieurs heures de retard, alors que le
// compteur de pas est disponible immédiatement). Ça évite qu'une journée
// avec beaucoup de marche compte pour "aucune activité" en Récupération.

import { getDb } from './db'
import { syncGoogleFit, getTodayGoogleFit } from './googleFit'
import { pushRecord, deleteRecord } from './cloudSync'
import { computeCaloriesFromSteps } from './met'
import type { Settings } from './settings'
import type { EnduranceSession } from '../types'

const STEPS_THRESHOLD = 3000

function syntheticId(date: string) {
  return `steps-${date}`
}

export async function autoLogWalkFromStepsIfNeeded(settings: Settings): Promise<void> {
  await syncGoogleFit()
  const today = await getTodayGoogleFit()
  if (!today || today.steps < STEPS_THRESHOLD) return

  const db = await getDb()
  const id = syntheticId(today.date)
  const dayStart = new Date(`${today.date}T00:00:00`).getTime()
  const dayEnd = dayStart + 24 * 3600_000
  const existing = await db.getAllFromIndex('endurance', 'byStartedAt', IDBKeyRange.bound(dayStart, dayEnd))

  // Une vraie séance de marche a déjà été importée de NutriTracker pour
  // aujourd'hui (via l'import d'activités) — pas la peine de doubler.
  const alreadyImported = existing.some((s) => s.activityType === 'marche' && s.externalId !== id)
  if (alreadyImported) {
    if (existing.some((s) => s.id === id)) {
      await db.delete('endurance', id)
      deleteRecord('endurance', id)
    }
    return
  }

  const durationMin = today.activeMinutes > 0 ? today.activeMinutes : Math.round(today.steps / 100)
  const caloriesBurned = today.activeCaloriesBurned > 0 ? today.activeCaloriesBurned : computeCaloriesFromSteps(today.steps, settings)

  const session: EnduranceSession = {
    id,
    activityType: 'marche',
    startedAt: dayStart + 12 * 3600_000,
    durationMin,
    caloriesBurned,
    externalId: id,
  }
  await db.put('endurance', session)
  pushRecord('endurance', id, session)
}
