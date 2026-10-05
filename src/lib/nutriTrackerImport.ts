// Import (pas push) : récupère l'historique d'activités déjà loggées côté
// NutriTracker — principalement les séances synchronisées automatiquement
// depuis Google Fit/HealthKit (fitnessData.googleFit.sessions), plus les
// entrées tapées à la main dans son UI — et les stocke en local. Chaque
// activité importée porte son id NutriTracker en externalId pour ne jamais
// être réimportée.

import { inferSource } from './dataSource'
import { getDb } from './db'
import { pullActivityHistoryFromNutriTracker, type RemoteActivity } from './nutriTrackerSync'
import { pushRecord } from './cloudSync'
import { ENDURANCE_ACTIVITY_META } from './endurance'
import { computeCaloriesForUser, computeCaloriesFromHr, bmrShareForDuration } from './met'
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
  // Variantes anglaises — un appareil en locale anglaise (ou une session
  // Google Fit/Apple Health sans nom localisé) peut renvoyer ces libellés
  // au lieu du français ; sans ce filet, ces séances de marche tombaient
  // dans le générique "Activité" au lieu d'être reconnues comme endurance.
  walking: 'marche',
  walk: 'marche',
  'brisk walking': 'marche',
  hiking: 'marche',
  hike: 'marche',
  course: 'course',
  'course à pied': 'course',
  jogging: 'course',
  running: 'course',
  run: 'course',
  vélo: 'velo',
  cyclisme: 'velo',
  vtt: 'velo',
  cycling: 'velo',
  biking: 'velo',
  natation: 'natation',
  swimming: 'natation',
  rameur: 'rameur',
  aviron: 'rameur',
  rowing: 'rameur',
  'tapis de course': 'tapis',
  treadmill: 'tapis',
  "vélo d'appartement": 'velo-appart',
  'vélo stationnaire': 'velo-appart',
  'stationary biking': 'velo-appart',
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

/** Une séance déjà importée peut s'enrichir côté montre après coup (FC, distance
 * qui arrivent avec la synchro suivante, durée corrigée). On met donc à jour ses
 * chiffres — sauf si on l'a enrichie à la main (photo, données machine, ressenti),
 * auquel cas on ne fait que combler ce qui manque. */
function refreshImported(local: EnduranceSession, a: RemoteActivity): EnduranceSession | null {
  const distanceKm = a.distanceM != null ? Math.round((a.distanceM / 1000) * 100) / 100 : undefined
  const userEnriched = !!local.photoDataUrl || local.rpe != null || (!!local.machineStats && local.machineStats.machineType !== 'other')
  const next: EnduranceSession = {
    ...local,
    distanceKm: local.distanceKm ?? distanceKm,
    avgHeartRate: local.avgHeartRate ?? a.heartRateAvg ?? undefined,
  }
  if (!userEnriched) {
    if (a.durationMin > 0) next.durationMin = a.durationMin
    if (distanceKm != null) next.distanceKm = distanceKm
    if (a.heartRateAvg != null) next.avgHeartRate = a.heartRateAvg
    if (a.caloriesBurned != null) next.caloriesBurned = a.caloriesBurned
  }
  const changed =
    next.durationMin !== local.durationMin ||
    next.distanceKm !== local.distanceKm ||
    next.avgHeartRate !== local.avgHeartRate ||
    next.caloriesBurned !== local.caloriesBurned
  if (!changed) return null
  if (next.distanceKm === undefined) delete next.distanceKm
  if (next.avgHeartRate === undefined) delete next.avgHeartRate
  return next
}

export async function importNutriTrackerActivityHistory(days: number, settings: Settings): Promise<number> {
  const remote = await pullActivityHistoryFromNutriTracker(days)
  if (remote.length === 0) return 0

  const db = await getDb()
  const [existingEndurance, existingActivities] = await Promise.all([db.getAll('endurance'), db.getAll('activities')])
  const enduranceByExternalId = new Map(existingEndurance.filter((s) => s.externalId).map((s) => [s.externalId as string, s]))
  const alreadyImported = new Set<string>([
    ...enduranceByExternalId.keys(),
    ...existingActivities.map((a) => a.externalId).filter((v): v is string => !!v),
  ])

  let imported = 0
  for (const a of remote) {
    if (alreadyImported.has(a.id)) {
      const local = enduranceByExternalId.get(a.id)
      const refreshed = local ? refreshImported(local, a) : null
      if (refreshed) {
        await db.put('endurance', refreshed)
        pushRecord('endurance', refreshed.id, refreshed)
      }
      continue
    }
    const startedAt = a.startMs ?? new Date(`${a.date}T12:00:00`).getTime()
    const enduranceType = matchEnduranceType(a)
    const distanceKm = a.distanceM != null ? Math.round((a.distanceM / 1000) * 100) / 100 : undefined

    if (enduranceType) {
      const meta = ENDURANCE_ACTIVITY_META[enduranceType]
      // Même priorité de précision que le reste de l'app : calories connues >
      // formule FC (Keytel) > MET générique du type d'activité.
      const estimatedCalories =
        (a.heartRateAvg ? computeCaloriesFromHr(a.heartRateAvg, a.durationMin, settings) : null) ??
        computeCaloriesForUser(meta.met, a.durationMin, settings)
      // Marche/randonnée importées peuvent durer plusieurs heures — retire la
      // part de BMR déjà comptée par ailleurs sur la journée (voir endurance.ts).
      const caloriesBurned =
        a.caloriesBurned ??
        (enduranceType === 'marche' ? Math.max(0, estimatedCalories - bmrShareForDuration(a.durationMin, settings)) : estimatedCalories)
      const machineStats: MachineStats | undefined =
        a.avgSpeedKmh != null || a.elevationGainM != null
          ? { machineType: 'other', avgSpeedKph: a.avgSpeedKmh ?? undefined, elevationGainM: a.elevationGainM ?? undefined }
          : undefined
      const session: EnduranceSession = {
        // Id déterministe : deux imports simultanés (démarrage + bouton, ou deux
        // appareils) réécrivent le même enregistrement au lieu d'en créer deux —
        // c'est ce qui avait dupliqué trois séances Apple Health en prod.
        id: `import-${a.id}`,
        activityType: enduranceType,
        startedAt,
        durationMin: a.durationMin,
        distanceKm,
        avgHeartRate: a.heartRateAvg ?? undefined,
        caloriesBurned,
        externalId: a.id,
        source: inferSource({ externalId: a.id }),
        ...(machineStats ? { machineStats } : {}),
      }
      await db.put('endurance', session)
      pushRecord('endurance', session.id, session)
    } else {
      // Pas de correspondance dans notre liste d'activités d'endurance — on
      // reconstruit un MET plausible depuis les calories connues plutôt que
      // d'inventer une valeur fixe, quand c'est possible.
      const metValue =
        a.caloriesBurned && a.durationMin > 0 && settings.bodyWeightKg > 0
          ? Math.round((a.caloriesBurned / (settings.bodyWeightKg * (a.durationMin / 60))) * 10) / 10
          : 4
      const log: ActivityLog = {
        id: `import-${a.id}`,
        category: 'outdoor',
        label: a.name,
        metValue,
        durationMin: a.durationMin,
        caloriesBurned: a.caloriesBurned ?? computeCaloriesForUser(metValue, a.durationMin, settings),
        loggedAt: startedAt,
        externalId: a.id,
        source: inferSource({ externalId: a.id }),
      }
      await db.put('activities', log)
      pushRecord('activities', log.id, log)
    }
    imported++
  }
  return imported
}

// Déclenchement automatique (démarrage, retour au premier plan, bouton Synchro) :
// voir refreshFitData() dans fitSync.ts, qui sérialise import, fusion et marche auto.
