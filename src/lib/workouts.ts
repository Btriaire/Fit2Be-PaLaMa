import { getDb } from './db'
import type { SetEntry, Workout } from '../types'

export interface LastPerformance {
  weightKg: number
  reps: number
  rpe?: number
  date: number
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

export async function deleteWorkout(id: string) {
  const db = await getDb()
  await db.delete('workouts', id)
}
