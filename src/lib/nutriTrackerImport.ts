// Import (pas push) : récupère l'historique d'activités déjà loggées côté
// NutriTracker — principalement les séances synchronisées automatiquement
// depuis Google Fit/HealthKit (fitnessData.googleFit.sessions), plus les
// entrées tapées à la main dans son UI — et les stocke en local. Chaque
// activité importée porte son id NutriTracker en externalId pour ne jamais
// être réimportée.

import { getDb, newId } from './db'
import { pullActivityHistoryFromNutriTracker, type RemoteActivity } from './nutriTrackerSync'
import { ENDURANCE_ACTIVITY_META } from './endurance'
import { computeCaloriesForUser, computeCaloriesFromHr } from './met'
import type { Settings } from './settings'
import type { ActivityLog, EnduranceActivityType, EnduranceSession, MachineStats } from '../types'

// Les activityType numériques venant de sessions HealthKit ne suivent pas
// forcément la même table de codes que NutriTracker (ex: observé "Vélo"
// taggé 17, qui vaut "Elliptique" dans sa propre table) — on matche donc
// d'abord sur le nom, lisible et fiable, et le code numérique en dernier recours.
const NAME_TO_ENDURANCE: Record<string, EnduranceActivityType> = {
  marche: 'marche',
  'marche rapide': 'marche',
  randonnée: 'marche',
  course: 'course',
  'course à pied': 'course',
  jogging: 'course',
  vélo: 'velo',
  cyclisme: 'velo',
  vtt: 'velo',
  natation: 'natation',
  rameur: 'rameur',
  aviron: 'rameur',
  'tapis de course': 'tapis',
  "vélo d'appartement": 'velo-appart',
  'vélo stationnaire': 'velo-appart',
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const NAME_TO_ENDURANCE_NORMALIZED = new Map(Object.entries(NAME_TO_ENDURANCE).map(([k, v]) => [normalize(k), v]))

const GOOGLE_FIT_TYPE_TO_ENDURANCE = new Map<number, EnduranceActivityType>(
  (Object.entries(ENDURANCE_ACTIVITY_META) as Array<[EnduranceActivityType, (typeof ENDURANCE_ACTIVITY_META)[EnduranceActivityType]]>).map(
    ([key, meta]) => [meta.googleFitType, key],
  ),
)

function matchEnduranceType(a: RemoteActivity): EnduranceActivityType | null {
  return NAME_TO_ENDURANCE_NORMALIZED.get(normalize(a.name)) ?? GOOGLE_FIT_TYPE_TO_ENDURANCE.get(a.activityType) ?? null
}

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
    const startedAt = a.startMs ?? new Date(`${a.date}T12:00:00`).getTime()
    const enduranceType = matchEnduranceType(a)
    const distanceKm = a.distanceM != null ? Math.round((a.distanceM / 1000) * 100) / 100 : undefined

    if (enduranceType) {
      const meta = ENDURANCE_ACTIVITY_META[enduranceType]
      // Même priorité de précision que le reste de l'app : calories connues >
      // formule FC (Keytel) > MET générique du type d'activité.
      const caloriesBurned =
        a.caloriesBurned ??
        (a.heartRateAvg ? computeCaloriesFromHr(a.heartRateAvg, a.durationMin, settings) : null) ??
        computeCaloriesForUser(meta.met, a.durationMin, settings)
      const machineStats: MachineStats | undefined =
        a.avgSpeedKmh != null || a.elevationGainM != null
          ? { machineType: 'other', avgSpeedKph: a.avgSpeedKmh ?? undefined, elevationGainM: a.elevationGainM ?? undefined }
          : undefined
      const session: EnduranceSession = {
        id: newId(),
        activityType: enduranceType,
        startedAt,
        durationMin: a.durationMin,
        distanceKm,
        avgHeartRate: a.heartRateAvg ?? undefined,
        caloriesBurned,
        externalId: a.id,
        ...(machineStats ? { machineStats } : {}),
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
