import { getDb, newId } from './db'
import { computeCaloriesForUser, computeCaloriesFromHr, computeCaloriesFromPhaseLog, bmrShareForDuration } from './met'
import { computeHrZone } from './heartRate'
import { pushActivityToNutriTracker } from './nutriTrackerSync'
import { pushRecord, deleteRecord } from './cloudSync'
import type { Settings } from './settings'
import type { EnduranceActivityType, EnduranceSession, HealthScreenCapture, MachineStats, PhaseLogEntry, RoutePoint } from '../types'

// googleFitType : code d'activité Google Fit repris par NutriTracker Palama
// (app/lib/google-fit.ts:ACTIVITY_LABELS) pour le libellé/icône de son flux
// d'activités — vérifié contre cette table le 26/08/2026 (course était à
// tort mappé sur 1="Aérobic" et tapis sur 3="Course", corrigés ici).
export const ENDURANCE_ACTIVITY_META: Record<
  EnduranceActivityType,
  { label: string; met: number; hasDistance: boolean; googleFitType: number }
> = {
  course: { label: 'Course à pied', met: 9.8, hasDistance: true, googleFitType: 41 },
  velo: { label: 'Vélo (route)', met: 8, hasDistance: true, googleFitType: 7 },
  natation: { label: 'Natation', met: 7, hasDistance: true, googleFitType: 93 },
  rameur: { label: 'Rameur', met: 7, hasDistance: false, googleFitType: 37 },
  'velo-appart': { label: "Vélo d'appartement", met: 6.8, hasDistance: false, googleFitType: 8 },
  tapis: { label: 'Tapis de course', met: 8.3, hasDistance: true, googleFitType: 67 },
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

export async function getEnduranceSession(id: string): Promise<EnduranceSession | undefined> {
  const db = await getDb()
  return db.get('endurance', id)
}

export async function logEnduranceSession(
  input: {
    activityType: EnduranceActivityType
    durationMin: number
    distanceKm?: number
    avgHeartRate?: number
    startedAt?: number
    route?: RoutePoint[]
    /** Calories réelles lues sur la machine — prioritaires sur l'estimation MET. */
    caloriesBurned?: number
    /** Métriques complètes lues sur l'écran de la machine (watts, pics, dénivelé...). */
    machineStats?: MachineStats
    /** Capture de l'écran machine scannée, conservée avec la sortie. */
    photoDataUrl?: string
    /** Difficulté ressentie (0-10), saisie après une séance live. */
    rpe?: number
    /** Programme coaching suivi, et détail réel phase par phase. */
    programId?: string
    phaseLog?: PhaseLogEntry[]
    /** Zones/récupération importées d'une capture Apple Health/Google Fit. */
    healthCapture?: HealthScreenCapture
  },
  settings: Settings,
): Promise<EnduranceSession> {
  const meta = ENDURANCE_ACTIVITY_META[input.activityType]
  // Priorité de précision : calories réelles de la machine > formule FC
  // (Keytel, reflète l'effort physiologique réel) > intégration phase par
  // phase d'un programme coaching (plus fin qu'un MET unique moyenné sur
  // toute la séance) > MET générique du type d'activité (dernier recours).
  const estimatedCalories =
    (input.avgHeartRate ? computeCaloriesFromHr(input.avgHeartRate, input.durationMin, settings) : null) ??
    (input.phaseLog && input.phaseLog.length > 0 ? computeCaloriesFromPhaseLog(input.phaseLog, settings) : null) ??
    computeCaloriesForUser(meta.met, input.durationMin, settings)
  // La marche peut durer plusieurs heures (randonnée, journée de marche) —
  // sur une telle durée, la part de métabolisme de base déjà incluse dans
  // l'estimation MET/FC devient non négligeable et fausse le bilan si le BMR
  // est déjà compté séparément sur la journée. On la retire pour la marche
  // seulement (les autres activités durent rarement assez pour que ça compte).
  const caloriesBurned =
    input.caloriesBurned ??
    (input.activityType === 'marche' ? Math.max(0, estimatedCalories - bmrShareForDuration(input.durationMin, settings)) : estimatedCalories)
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
    ...(input.machineStats ? { machineStats: input.machineStats } : {}),
    ...(input.photoDataUrl ? { photoDataUrl: input.photoDataUrl } : {}),
    ...(input.rpe != null ? { rpe: input.rpe } : {}),
    ...(input.programId ? { programId: input.programId } : {}),
    ...(input.phaseLog && input.phaseLog.length > 0 ? { phaseLog: input.phaseLog } : {}),
    ...(input.healthCapture ? { healthCapture: input.healthCapture } : {}),
  }
  const db = await getDb()
  await db.put('endurance', session)
  pushRecord('endurance', session.id, session)

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
  deleteRecord('endurance', id)
}

/** Réassigne le type d'activité d'une sortie déjà enregistrée (ex: une
 * machine mal identifiée par le scan photo). Les calories mesurées (FC réelle
 * ou machine) restent inchangées — seule l'estimation MET générique, quand
 * c'était la seule donnée disponible, est recalculée pour le nouveau type. */
export async function updateEnduranceActivityType(
  id: string,
  activityType: EnduranceActivityType,
  settings: Settings,
): Promise<EnduranceSession | null> {
  const db = await getDb()
  const session = await db.get('endurance', id)
  if (!session) return null

  const meta = ENDURANCE_ACTIVITY_META[activityType]
  const hadMeasuredCalories = !!session.avgHeartRate || !!session.machineStats
  const caloriesBurned = hadMeasuredCalories
    ? session.caloriesBurned
    : activityType === 'marche'
      ? Math.max(0, computeCaloriesForUser(meta.met, session.durationMin, settings) - bmrShareForDuration(session.durationMin, settings))
      : computeCaloriesForUser(meta.met, session.durationMin, settings)

  const updated: EnduranceSession = { ...session, activityType, caloriesBurned }
  await db.put('endurance', updated)
  pushRecord('endurance', updated.id, updated)

  void pushActivityToNutriTracker({
    name: meta.label,
    activityType: meta.googleFitType,
    durationMin: updated.durationMin,
    caloriesBurned,
    date: new Date(updated.startedAt).toISOString().slice(0, 10),
  })

  return updated
}

export interface EnduranceHistoryPoint {
  date: number
  distanceKm?: number
  paceMinPerKm: number | null
  durationMin: number
  avgHeartRate?: number
  caloriesBurned: number
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
      caloriesBurned: s.caloriesBurned,
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
