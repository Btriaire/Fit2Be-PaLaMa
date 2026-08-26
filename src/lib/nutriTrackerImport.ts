// Import (pas push) : récupère l'historique d'activités déjà loggées côté
// NutriTracker (dans son UI, pas celles que VibeFit lui a poussées — le
// serveur les exclut déjà) et les stocke en local. Chaque activité importée
// porte son id NutriTracker en externalId pour ne jamais être réimportée.

import { getDb, newId } from './db'
import { pullActivityHistoryFromNutriTracker } from './nutriTrackerSync'
import { ENDURANCE_ACTIVITY_META } from './endurance'
import { computeCaloriesForUser } from './met'
import type { Settings } from './settings'
import type { ActivityLog, EnduranceActivityType, EnduranceSession } from '../types'

const GOOGLE_FIT_TO_ENDURANCE = new Map<number, EnduranceActivityType>(
  (Object.entries(ENDURANCE_ACTIVITY_META) as Array<[EnduranceActivityType, (typeof ENDURANCE_ACTIVITY_META)[EnduranceActivityType]]>).map(
    ([key, meta]) => [meta.googleFitType, key],
  ),
)

export async function importNutriTrackerActivityHistory(days: number, settings: Settings): Promise<number> {
  const remote = await pullActivityHistoryFromNutriTracker(days)
  if (remote.length === 0) return 0

  const db = await getDb()
  const [existingEndurance, existingActivities] = await Promise.all([db.getAll('endurance'), db.getAll('activities')])
  const alreadyImported = new Set<string>([
    ...existingEndurance.map((s) => s.externalId).filter((v): v is string => !!v),
    ...existingActivities.map((a) => a.externalId).filter((v): v is string => !!v),
  ])

  let imported = 0
  for (const a of remote) {
    if (alreadyImported.has(a.id)) continue
    const startedAt = new Date(`${a.date}T12:00:00`).getTime()
    const enduranceType = GOOGLE_FIT_TO_ENDURANCE.get(a.activityType)

    if (enduranceType) {
      const meta = ENDURANCE_ACTIVITY_META[enduranceType]
      const session: EnduranceSession = {
        id: newId(),
        activityType: enduranceType,
        startedAt,
        durationMin: a.durationMin,
        caloriesBurned: a.caloriesBurned ?? computeCaloriesForUser(meta.met, a.durationMin, settings),
        externalId: a.id,
      }
      await db.put('endurance', session)
    } else {
      // Pas de correspondance dans notre liste d'activités d'endurance — on
      // reconstruit un MET plausible depuis les calories connues plutôt que
      // d'inventer une valeur fixe, quand c'est possible.
      const metValue =
        a.caloriesBurned && a.durationMin > 0 && settings.bodyWeightKg > 0
          ? Math.round((a.caloriesBurned / (settings.bodyWeightKg * (a.durationMin / 60))) * 10) / 10
          : 4
      const log: ActivityLog = {
        id: newId(),
        category: 'outdoor',
        label: a.name,
        metValue,
        durationMin: a.durationMin,
        caloriesBurned: a.caloriesBurned ?? computeCaloriesForUser(metValue, a.durationMin, settings),
        loggedAt: startedAt,
        externalId: a.id,
      }
      await db.put('activities', log)
    }
    imported++
  }
  return imported
}
