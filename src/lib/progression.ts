// Index de progression — scores 0-100 dérivés de tendances mesurées (pas de
// magie ML) : on compare une fenêtre récente à une fenêtre ancienne pour
// chaque signal (poids/volume en musculation, efficacité watts-ou-vitesse
// par battement de cœur en cardio) et on mappe le %  de variation sur 0-100
// autour d'un point neutre à 50.

import { getAllWorkouts, getExerciseHistory, getLoggedExerciseIds } from './workouts'
import { getEnduranceSessions, ENDURANCE_ACTIVITY_META } from './endurance'
import { ALL_EXERCISES } from './exercises'
import type { EnduranceActivityType, EnduranceSession } from '../types'

export interface ProgressionIndex {
  score: number // 0-100, 50 = neutre/stable
  trendPct: number // variation signée entre fenêtre ancienne et récente
  sampleSize: number
}

const NEUTRAL: ProgressionIndex = { score: 50, trendPct: 0, sampleSize: 0 }

/** Compare la moyenne des ~3 premiers points à celle des ~3 derniers, exprime
 * un %  de variation, et le mappe sur une échelle 0-100 centrée à 50
 * (± 25 % de variation = score extrême). */
function trendFromSeries(values: number[]): ProgressionIndex {
  if (values.length < 2) return { score: 50, trendPct: 0, sampleSize: values.length }
  const half = Math.min(3, Math.floor(values.length / 2)) || 1
  const early = values.slice(0, half)
  const recent = values.slice(-half)
  const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  if (earlyAvg <= 0) return { score: 50, trendPct: 0, sampleSize: values.length }
  const trendPct = ((recentAvg - earlyAvg) / earlyAvg) * 100
  const score = Math.max(0, Math.min(100, 50 + trendPct * 2))
  return { score: Math.round(score), trendPct: Math.round(trendPct * 10) / 10, sampleSize: values.length }
}

function weightedAverage(indices: ProgressionIndex[]): ProgressionIndex {
  const withData = indices.filter((i) => i.sampleSize >= 2)
  if (withData.length === 0) return NEUTRAL
  let scoreSum = 0
  let trendSum = 0
  let weightSum = 0
  for (const i of withData) {
    const w = Math.log2(i.sampleSize + 1)
    scoreSum += i.score * w
    trendSum += i.trendPct * w
    weightSum += w
  }
  return {
    score: Math.round(scoreSum / weightSum),
    trendPct: Math.round((trendSum / weightSum) * 10) / 10,
    sampleSize: withData.reduce((s, i) => s + i.sampleSize, 0),
  }
}

// ---- Musculation ----

export interface ExerciseIndex {
  exerciseId: string
  name: string
  index: ProgressionIndex
}

/** Index par exercice : tendance combinée poids max (60%) + volume (40%). */
export async function computeSpecificMuscularIndices(): Promise<ExerciseIndex[]> {
  const logged = await getLoggedExerciseIds()
  const results: ExerciseIndex[] = []
  for (const { exerciseId } of logged) {
    const history = await getExerciseHistory(exerciseId)
    if (history.length < 2) continue
    const weightTrend = trendFromSeries(history.map((h) => h.maxWeightKg))
    const volumeTrend = trendFromSeries(history.map((h) => h.bestVolume))
    const blended: ProgressionIndex = {
      score: Math.round(weightTrend.score * 0.6 + volumeTrend.score * 0.4),
      trendPct: Math.round((weightTrend.trendPct * 0.6 + volumeTrend.trendPct * 0.4) * 10) / 10,
      sampleSize: history.length,
    }
    const name = ALL_EXERCISES.find((e) => e.id === exerciseId)?.name ?? exerciseId
    results.push({ exerciseId, name, index: blended })
  }
  return results.sort((a, b) => b.index.trendPct - a.index.trendPct)
}

export async function computeMuscularIndex(): Promise<ProgressionIndex> {
  const specific = await computeSpecificMuscularIndices()
  return weightedAverage(specific.map((s) => s.index))
}

// ---- Cardio ----

export interface ActivityIndex {
  activityType: EnduranceActivityType
  label: string
  index: ProgressionIndex
}

/** Efficacité d'une sortie : distance/min/FC (vitesse par battement) si on a
 * une distance, sinon watts/FC (puissance par battement) si scanné sur
 * machine — plus la valeur est haute, moins l'effort cardiaque est grand
 * pour le même travail, donc plus la forme cardio est bonne. */
export function sessionEfficiency(s: EnduranceSession): number | null {
  if (!s.avgHeartRate || s.avgHeartRate <= 0) return null
  if (s.distanceKm && s.durationMin > 0) {
    return (s.distanceKm / s.durationMin / s.avgHeartRate) * 1000
  }
  if (s.machineStats?.avgWatts) {
    return s.machineStats.avgWatts / s.avgHeartRate
  }
  return null
}

export async function computeSpecificCardiacIndices(): Promise<ActivityIndex[]> {
  const sessions = await getEnduranceSessions()
  const byType = new Map<EnduranceActivityType, EnduranceSession[]>()
  for (const s of sessions) {
    if (sessionEfficiency(s) === null) continue
    const arr = byType.get(s.activityType) ?? []
    arr.push(s)
    byType.set(s.activityType, arr)
  }
  const results: ActivityIndex[] = []
  for (const [activityType, list] of byType) {
    // chronologique croissant pour que "récent" = fin de série
    const chrono = [...list].reverse()
    const effs = chrono.map((s) => sessionEfficiency(s)!).filter((v): v is number => v !== null)
    if (effs.length < 2) continue
    results.push({ activityType, label: ENDURANCE_ACTIVITY_META[activityType].label, index: trendFromSeries(effs) })
  }
  return results.sort((a, b) => b.index.trendPct - a.index.trendPct)
}

export async function computeCardiacIndex(): Promise<ProgressionIndex> {
  const specific = await computeSpecificCardiacIndices()
  return weightedAverage(specific.map((s) => s.index))
}

// ---- Régularité & index général ----

/** Jours distincts avec au moins une activité (gym/endurance) sur les 14 derniers jours. */
async function computeConsistencyIndex(): Promise<ProgressionIndex> {
  const [workouts, endurance] = await Promise.all([getAllWorkouts(), getEnduranceSessions()])
  const cutoff = Date.now() - 14 * 24 * 3600_000
  const days = new Set<string>()
  for (const w of workouts) {
    if (w.finishedAt && w.startedAt >= cutoff) days.add(new Date(w.startedAt).toISOString().slice(0, 10))
  }
  for (const e of endurance) {
    if (e.startedAt >= cutoff) days.add(new Date(e.startedAt).toISOString().slice(0, 10))
  }
  // 8 jours actifs / 14 = score plein — rythme "un jour sur deux" jugé solide.
  const score = Math.max(0, Math.min(100, Math.round((days.size / 8) * 100)))
  return { score, trendPct: 0, sampleSize: days.size }
}

export interface GeneralProgression {
  general: ProgressionIndex
  muscular: ProgressionIndex
  cardiac: ProgressionIndex
  consistency: ProgressionIndex
}

export async function computeGeneralIndex(): Promise<GeneralProgression> {
  const [muscular, cardiac, consistency] = await Promise.all([
    computeMuscularIndex(),
    computeCardiacIndex(),
    computeConsistencyIndex(),
  ])
  const general: ProgressionIndex = {
    score: Math.round(muscular.score * 0.4 + cardiac.score * 0.4 + consistency.score * 0.2),
    trendPct: Math.round((muscular.trendPct * 0.5 + cardiac.trendPct * 0.5) * 10) / 10,
    sampleSize: muscular.sampleSize + cardiac.sampleSize,
  }
  return { general, muscular, cardiac, consistency }
}
