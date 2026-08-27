import { getDb } from './db'
import { computeCaloriesForUser, GYM_WORKOUT_MET } from './met'
import { pushActivityToNutriTracker } from './nutriTrackerSync'
import { pushRecord, deleteRecord } from './cloudSync'
import { ALL_EXERCISES, MUSCLE_GROUPS } from './exercises'
import type { Settings } from './settings'
import type { SetEntry, Workout } from '../types'

// Code d'activité Google Fit "Musculation" repris par NutriTracker Palama
// (app/lib/google-fit.ts:ACTIVITY_LABELS) pour le flux d'activités.
const GYM_GOOGLE_FIT_TYPE = 60

export interface LastPerformance {
  weightKg: number
  reps: number
  rpe?: number
  date: number
}

/** Durée approximative pour un exercice (N séries de travail + temps de repos), en minutes. */
export function estimateExerciseDurationMin(restTimerDefaultSec: number, typicalSets = 3): number {
  const setExecutionSec = 35
  const totalSec = typicalSets * setExecutionSec + (typicalSets - 1) * restTimerDefaultSec
  return Math.max(1, Math.round(totalSec / 60))
}

export interface BestPerformance {
  maxWeightKg: number
  maxVolume: number // weight x reps, best single set
}

/** Dernière performance connue pour un exercice, tous workouts confondus (hors séance en cours). */
export async function getLastPerformance(exerciseId: string, excludeWorkoutId?: string): Promise<LastPerformance | null> {
  const db = await getDb()
  const all = await db.getAllFromIndex('workouts', 'byStartedAt')
  for (let i = all.length - 1; i >= 0; i--) {
    const w = all[i]
    if (w.id === excludeWorkoutId) continue
    const we = w.exercises.find((e) => e.exerciseId === exerciseId)
    if (!we || we.sets.length === 0) continue
    const workingSets = we.sets.filter((s) => !s.isWarmup)
    const last = (workingSets.length ? workingSets : we.sets).at(-1)
    if (!last) continue
    return { weightKg: last.weightKg, reps: last.reps, rpe: last.rpe, date: w.startedAt }
  }
  return null
}

/** Meilleure perf historique pour un exercice (pour détection de PR), hors séance en cours. */
export async function getBestPerformance(exerciseId: string, excludeWorkoutId?: string): Promise<BestPerformance> {
  const db = await getDb()
  const all = await db.getAll('workouts')
  let maxWeightKg = 0
  let maxVolume = 0
  for (const w of all) {
    if (w.id === excludeWorkoutId) continue
    const we = w.exercises.find((e) => e.exerciseId === exerciseId)
    if (!we) continue
    for (const s of we.sets) {
      if (s.isWarmup) continue
      if (s.weightKg > maxWeightKg) maxWeightKg = s.weightKg
      const vol = s.weightKg * s.reps
      if (vol > maxVolume) maxVolume = vol
    }
  }
  return { maxWeightKg, maxVolume }
}

export function detectPr(set: Pick<SetEntry, 'weightKg' | 'reps' | 'isWarmup'>, best: BestPerformance): boolean {
  if (set.isWarmup) return false
  const volume = set.weightKg * set.reps
  return set.weightKg > best.maxWeightKg || volume > best.maxVolume
}

export async function saveWorkout(workout: Workout) {
  const db = await getDb()
  await db.put('workouts', workout)
  pushRecord('workouts', workout.id, workout)
}

export async function getWorkout(id: string): Promise<Workout | undefined> {
  const db = await getDb()
  return db.get('workouts', id)
}

export async function getAllWorkouts(): Promise<Workout[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('workouts', 'byStartedAt')
  return all.reverse()
}

/** Moyenne du RPE saisi sur les séries de travail (hors échauffement) de la séance. */
function averageRpe(workout: Workout): number | null {
  const rpes = workout.exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup && s.rpe != null).map((s) => s.rpe!))
  if (rpes.length === 0) return null
  return rpes.reduce((a, b) => a + b, 0) / rpes.length
}

/**
 * Calories brûlées estimées pour une séance de gym. Le MET fixe (5.5) sert de
 * base "effort modéré non qualifié" ; dès qu'un RPE a été saisi sur au moins
 * une série, le MET est ajusté à l'intensité réelle (RPE 5 ≈ MET de base,
 * RPE 8 ≈ +1.5, RPE 3 ≈ -1) plutôt que de rester figé peu importe l'effort.
 */
export function estimateWorkoutCalories(workout: Workout, settings: Settings): number {
  if (!workout.finishedAt) return 0
  const durationMin = (workout.finishedAt - workout.startedAt) / 60000
  if (durationMin <= 0) return 0
  const avgRpe = averageRpe(workout)
  const met = avgRpe != null ? Math.max(3, Math.min(9, GYM_WORKOUT_MET + (avgRpe - 5) * 0.5)) : GYM_WORKOUT_MET
  return computeCaloriesForUser(met, durationMin, settings)
}

export async function deleteWorkout(id: string) {
  const db = await getDb()
  await db.delete('workouts', id)
  deleteRecord('workouts', id)
}

/** Termine une séance : fixe finishedAt, sauvegarde, et pousse vers
 * NutriTracker Palama (best-effort, comme les autres modules). */
export async function finishWorkout(workout: Workout, settings: Settings): Promise<Workout> {
  const finished: Workout = { ...workout, finishedAt: Date.now() }
  await saveWorkout(finished)
  const caloriesBurned = estimateWorkoutCalories(finished, settings)
  const durationMin = Math.max(1, Math.round((finished.finishedAt! - finished.startedAt) / 60000))
  void pushActivityToNutriTracker({
    name: finished.name,
    activityType: GYM_GOOGLE_FIT_TYPE,
    durationMin,
    caloriesBurned,
    date: new Date(finished.startedAt).toISOString().slice(0, 10),
  })
  return finished
}

/** 1RM estimé (formule d'Epley) — un 100kg×1 et un 100kg×8 ne représentent
 * pas la même force ; l'estimation ramène toute série à une base comparable. */
export function estimated1Rm(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export interface ExerciseHistoryPoint {
  date: number
  maxWeightKg: number
  bestVolume: number
  totalSets: number
  estimated1RM: number
}

/** Historique chronologique (une entrée par séance) des perfs pour un exercice donné. */
export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistoryPoint[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('workouts', 'byStartedAt')
  const points: ExerciseHistoryPoint[] = []
  for (const w of all) {
    const we = w.exercises.find((e) => e.exerciseId === exerciseId)
    if (!we) continue
    const workingSets = we.sets.filter((s) => !s.isWarmup)
    if (workingSets.length === 0) continue
    const maxWeightKg = Math.max(...workingSets.map((s) => s.weightKg))
    const bestVolume = Math.max(...workingSets.map((s) => s.weightKg * s.reps))
    const estimated1RM = Math.max(...workingSets.map((s) => estimated1Rm(s.weightKg, s.reps)))
    points.push({ date: w.startedAt, maxWeightKg, bestVolume, totalSets: workingSets.length, estimated1RM })
  }
  return points
}

export interface MuscleGroupStat {
  muscleGroup: string
  totalSets: number
  totalVolume: number
}

/** Volume (séries + kg soulevés) par groupe musculaire sur les N derniers jours. */
export async function getMuscleGroupVolume(days = 7): Promise<MuscleGroupStat[]> {
  const exerciseById = new Map(ALL_EXERCISES.map((e) => [e.id, e]))
  const cutoff = Date.now() - days * 24 * 3600_000
  const all = await getAllWorkouts()
  const map = new Map<string, MuscleGroupStat>()
  for (const w of all.filter((w) => w.startedAt >= cutoff)) {
    for (const we of w.exercises) {
      const group = exerciseById.get(we.exerciseId)?.muscleGroup
      if (!group) continue
      const workingSets = we.sets.filter((s) => !s.isWarmup)
      if (workingSets.length === 0) continue
      const entry = map.get(group) ?? { muscleGroup: group, totalSets: 0, totalVolume: 0 }
      entry.totalSets += workingSets.length
      entry.totalVolume += workingSets.reduce((s, x) => s + x.weightKg * x.reps, 0)
      map.set(group, entry)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalVolume - a.totalVolume)
}

export interface MuscleGroupFreshness {
  muscleGroup: string
  daysSinceLast: number | null
}

/** Jours écoulés depuis la dernière séance ayant sollicité chaque groupe
 * musculaire connu (tous ceux de la bibliothèque, pas seulement ceux déjà loggés). */
export async function getMuscleGroupFreshness(): Promise<MuscleGroupFreshness[]> {
  const exerciseById = new Map(ALL_EXERCISES.map((e) => [e.id, e]))
  const all = await getAllWorkouts()
  const lastTrained = new Map<string, number>()
  for (const w of all) {
    for (const we of w.exercises) {
      if (we.sets.filter((s) => !s.isWarmup).length === 0) continue
      const group = exerciseById.get(we.exerciseId)?.muscleGroup
      if (!group) continue
      const prev = lastTrained.get(group) ?? 0
      if (w.startedAt > prev) lastTrained.set(group, w.startedAt)
    }
  }
  const now = Date.now()
  return MUSCLE_GROUPS.map((muscleGroup) => {
    const last = lastTrained.get(muscleGroup)
    return { muscleGroup, daysSinceLast: last ? Math.floor((now - last) / 86_400_000) : null }
  })
}

export interface SessionPrStat {
  date: number
  workingSets: number
  prCount: number
}

/** Séries de travail et PR par séance, pour calculer un taux de PR dans le temps. */
export async function getPrStats(): Promise<SessionPrStat[]> {
  const all = await getAllWorkouts()
  return all
    .filter((w) => w.finishedAt)
    .map((w) => {
      const workingSets = w.exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup))
      return { date: w.startedAt, workingSets: workingSets.length, prCount: workingSets.filter((s) => s.isPr).length }
    })
    .filter((s) => s.workingSets > 0)
}

/** Identifiants de tous les exercices déjà loggés au moins une fois, avec leur dernière date. */
export async function getLoggedExerciseIds(): Promise<Array<{ exerciseId: string; lastDate: number }>> {
  const db = await getDb()
  const all = await db.getAll('workouts')
  const map = new Map<string, number>()
  for (const w of all) {
    for (const we of w.exercises) {
      if (we.sets.length === 0) continue
      const prev = map.get(we.exerciseId) ?? 0
      if (w.startedAt > prev) map.set(we.exerciseId, w.startedAt)
    }
  }
  return Array.from(map.entries())
    .map(([exerciseId, lastDate]) => ({ exerciseId, lastDate }))
    .sort((a, b) => b.lastDate - a.lastDate)
}

export interface EffortDistribution {
  ratedSets: number
  avgRpe: number | null
  buckets: { label: string; count: number; pct: number }[]
}

const EFFORT_BUCKETS = [
  { label: 'Facile', max: 4 },
  { label: 'Modéré', max: 6 },
  { label: 'Difficile', max: 8 },
  { label: 'Très difficile', max: 9.5 },
  { label: 'Échec', max: Infinity },
]

/** Répartition des niveaux de difficulté saisis (RPE, mode Focus ou saisie
 * manuelle) sur les séries de musculation des N derniers jours — donne une
 * vue directe de "à quelle intensité je m'entraîne réellement", complément
 * du volume (kg x reps) qui ne dit rien de l'effort ressenti. */
export async function computeEffortDistribution(days = 14): Promise<EffortDistribution> {
  const cutoff = Date.now() - days * 86_400_000
  const all = await getAllWorkouts()
  const rpes: number[] = []
  for (const w of all.filter((w) => w.startedAt >= cutoff)) {
    for (const we of w.exercises) {
      for (const s of we.sets) {
        if (!s.isWarmup && s.rpe != null) rpes.push(s.rpe)
      }
    }
  }
  const buckets = EFFORT_BUCKETS.map((b, i) => {
    const min = i === 0 ? 0 : EFFORT_BUCKETS[i - 1].max
    const count = rpes.filter((r) => r > min - 1e-9 && r <= b.max).length
    return { label: b.label, count, pct: rpes.length > 0 ? Math.round((count / rpes.length) * 100) : 0 }
  })
  return {
    ratedSets: rpes.length,
    avgRpe: rpes.length > 0 ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
    buckets,
  }
}
