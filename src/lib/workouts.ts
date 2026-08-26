import { getDb } from './db'
import { computeCaloriesForUser, GYM_WORKOUT_MET } from './met'
import type { Settings } from './settings'
import type { SetEntry, Workout } from '../types'

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

/** Calories brûlées estimées pour une séance de gym, selon le profil démographique. */
export function estimateWorkoutCalories(workout: Workout, settings: Settings): number {
  if (!workout.finishedAt) return 0
  const durationMin = (workout.finishedAt - workout.startedAt) / 60000
  if (durationMin <= 0) return 0
  return computeCaloriesForUser(GYM_WORKOUT_MET, durationMin, settings)
}

export async function deleteWorkout(id: string) {
  const db = await getDb()
  await db.delete('workouts', id)
}

export interface ExerciseHistoryPoint {
  date: number
  maxWeightKg: number
  bestVolume: number
  totalSets: number
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
    points.push({ date: w.startedAt, maxWeightKg, bestVolume, totalSets: workingSets.length })
  }
  return points
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
