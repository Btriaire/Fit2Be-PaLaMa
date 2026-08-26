// Index de progression — scores 0-100 dérivés de tendances mesurées (pas de
// magie ML) : on compare une fenêtre récente à une fenêtre ancienne pour
// chaque signal (poids/volume en musculation, efficacité watts-ou-vitesse
// par battement de cœur en cardio) et on mappe le %  de variation sur 0-100
// autour d'un point neutre à 50.

import { getAllWorkouts, getExerciseHistory, getLoggedExerciseIds, getPrStats, estimateWorkoutCalories } from './workouts'
import { getEnduranceSessions, ENDURANCE_ACTIVITY_META } from './endurance'
import { enduranceSessionLoad } from './recovery'
import { computeMaxHr } from './heartRate'
import { getDb } from './db'
import { ALL_EXERCISES } from './exercises'
import type { Settings } from './settings'
import type { ActivityLog, EnduranceActivityType, EnduranceSession } from '../types'

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

/** Index par exercice : tendance combinée 1RM estimé Epley (65%, corrige le
 * biais d'un simple poids max — 100kg×1 et 100kg×8 ne valent pas pareil) +
 * volume (35%). */
export async function computeSpecificMuscularIndices(): Promise<ExerciseIndex[]> {
  const logged = await getLoggedExerciseIds()
  const results: ExerciseIndex[] = []
  for (const { exerciseId } of logged) {
    const history = await getExerciseHistory(exerciseId)
    if (history.length < 2) continue
    const oneRmTrend = trendFromSeries(history.map((h) => h.estimated1RM))
    const volumeTrend = trendFromSeries(history.map((h) => h.bestVolume))
    const blended: ProgressionIndex = {
      score: Math.round(oneRmTrend.score * 0.65 + volumeTrend.score * 0.35),
      trendPct: Math.round((oneRmTrend.trendPct * 0.65 + volumeTrend.trendPct * 0.35) * 10) / 10,
      sampleSize: history.length,
    }
    const name = ALL_EXERCISES.find((e) => e.id === exerciseId)?.name ?? exerciseId
    results.push({ exerciseId, name, index: blended })
  }
  return results.sort((a, b) => b.index.trendPct - a.index.trendPct)
}

/** Tendance du taux de PR (records / séries de travail) sur les séances récentes. */
export async function computePrRateIndex(): Promise<ProgressionIndex> {
  const stats = await getPrStats()
  if (stats.length < 2) return NEUTRAL
  const rates = stats.map((s) => (s.workingSets > 0 ? s.prCount / s.workingSets : 0))
  return trendFromSeries(rates)
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

// ---- Cardio : VO2max, polarisation, charge cumulée ----

export interface Vo2MaxEstimate {
  vo2max: number
  hrMaxUsed: number
  source: 'mesuré' | 'estimé'
}

/** VO2max estimé (Uth-Sørensen-Overgaard-Pedersen, 2004) : 15.3 x FCmax/FCrepos.
 * FCmax utilise le pic réellement observé sur une machine scannée s'il existe
 * (plus fiable qu'une formule), sinon la formule 220-âge classique. */
export async function computeVo2Max(ageYears: number, restingHrBpm: number): Promise<Vo2MaxEstimate | null> {
  const sessions = await getEnduranceSessions()
  let observedPeak = 0
  for (const s of sessions) {
    const peak = s.machineStats?.peakHeartRate ?? null
    if (peak && peak > observedPeak) observedPeak = peak
  }
  const formulaic = computeMaxHr(ageYears)
  const hrMaxUsed = observedPeak > formulaic * 0.6 ? observedPeak : formulaic
  if (restingHrBpm <= 0 || hrMaxUsed <= restingHrBpm) return null
  return {
    vo2max: Math.round(15.3 * (hrMaxUsed / restingHrBpm) * 10) / 10,
    hrMaxUsed: Math.round(hrMaxUsed),
    source: observedPeak > formulaic * 0.6 ? 'mesuré' : 'estimé',
  }
}

export interface Polarization {
  easyPct: number // Z1-2
  moderatePct: number // Z3
  hardPct: number // Z4-5
  totalMinutes: number
}

/** Répartition du temps cardio par intensité sur N jours — le modèle
 * "polarisé" (≈80% facile / 20% dur, peu de zone 3) est associé à de
 * meilleurs gains d'endurance que l'entraînement à effort moyen constant. */
export async function computePolarization(days = 28): Promise<Polarization | null> {
  const cutoff = Date.now() - days * 86_400_000
  const sessions = (await getEnduranceSessions()).filter((s) => s.startedAt >= cutoff && s.hrZone != null)
  if (sessions.length === 0) return null
  let easy = 0
  let moderate = 0
  let hard = 0
  for (const s of sessions) {
    if (s.hrZone! <= 2) easy += s.durationMin
    else if (s.hrZone === 3) moderate += s.durationMin
    else hard += s.durationMin
  }
  const total = easy + moderate + hard
  if (total === 0) return null
  return {
    easyPct: Math.round((easy / total) * 100),
    moderatePct: Math.round((moderate / total) * 100),
    hardPct: Math.round((hard / total) * 100),
    totalMinutes: total,
  }
}

/** Charge cardio cumulée (sous-ensemble "endurance" de la charge session-RPE)
 * sur 7 et 28 jours — complète l'indice cardiaque (qui mesure l'efficacité)
 * avec le volume brut d'effort cardio fourni. */
export async function computeCardioLoadCumulative(ageYears: number): Promise<{ load7d: number; load28d: number }> {
  const sessions = await getEnduranceSessions()
  const now = Date.now()
  let load7 = 0
  let load28 = 0
  for (const s of sessions) {
    const ageMs = now - s.startedAt
    if (ageMs > 28 * 86_400_000) continue
    const load = enduranceSessionLoad(s, ageYears, ENDURANCE_ACTIVITY_META[s.activityType].label).load
    load28 += load
    if (ageMs <= 7 * 86_400_000) load7 += load
  }
  return { load7d: Math.round(load7), load28d: Math.round(load28) }
}

// ---- Diversité, balance énergétique, tendance Body Battery ----

function shannonEntropyNormalized(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  const probs = values.filter((v) => v > 0).map((v) => v / total)
  const entropy = -probs.reduce((s, p) => s + p * Math.log2(p), 0)
  const maxEntropy = Math.log2(values.length)
  return Math.round((entropy / maxEntropy) * 100)
}

export interface DiversityIndex {
  score: number // 0-100, 100 = temps réparti également entre les 3 modules
  gymMin: number
  enduranceMin: number
  activityMin: number
}

/** Indice de diversité (entropie de Shannon) entre gym / endurance / activités
 * sur N jours — un score bas signale un mono-sport qui isole certains index
 * (ex: index cardiaque jamais alimenté si 100% muscu). */
export async function computeDiversityIndex(days = 14): Promise<DiversityIndex> {
  const cutoff = Date.now() - days * 86_400_000
  const [workouts, endurance, db] = await Promise.all([getAllWorkouts(), getEnduranceSessions(), getDb()])
  const activities: ActivityLog[] = await db.getAll('activities')

  const gymMin = workouts
    .filter((w) => w.finishedAt && w.startedAt >= cutoff)
    .reduce((s, w) => s + (w.finishedAt! - w.startedAt) / 60000, 0)
  const enduranceMin = endurance.filter((e) => e.startedAt >= cutoff).reduce((s, e) => s + e.durationMin, 0)
  const activityMin = activities.filter((a) => a.loggedAt >= cutoff).reduce((s, a) => s + a.durationMin, 0)

  return {
    score: shannonEntropyNormalized([gymMin, enduranceMin, activityMin]),
    gymMin: Math.round(gymMin),
    enduranceMin: Math.round(enduranceMin),
    activityMin: Math.round(activityMin),
  }
}

export interface EnergyBalanceTrend {
  avgBalance7d: number // kcal consommées - brûlées, moyenne 7j (positif = surplus)
  days: Array<{ date: string; balance: number }>
}

/** Moyenne mobile 7j de la balance calorique (nutrition - dépense tous
 * modules) — formalise en "indice" ce qui n'était visible qu'au jour le jour
 * dans Stats. */
export async function computeEnergyBalanceTrend(settings: Settings): Promise<EnergyBalanceTrend> {
  const [workouts, endurance, db] = await Promise.all([getAllWorkouts(), getEnduranceSessions(), getDb()])
  const activities: ActivityLog[] = await db.getAll('activities')
  const nutrition = await db.getAll('nutrition')

  const days: Array<{ date: string; balance: number }> = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = dayStart.getTime() + 86_400_000

    const burned =
      workouts
        .filter((w) => w.finishedAt && w.startedAt >= dayStart.getTime() && w.startedAt < dayEnd)
        .reduce((s, w) => s + estimateWorkoutCalories(w, settings), 0) +
      activities
        .filter((a) => a.loggedAt >= dayStart.getTime() && a.loggedAt < dayEnd)
        .reduce((s, a) => s + a.caloriesBurned, 0) +
      endurance
        .filter((e) => e.startedAt >= dayStart.getTime() && e.startedAt < dayEnd)
        .reduce((s, e) => s + e.caloriesBurned, 0)
    const consumed = nutrition
      .filter((n) => n.loggedAt >= dayStart.getTime() && n.loggedAt < dayEnd)
      .reduce((s, n) => s + n.calories, 0)

    days.push({ date: dayStart.toISOString().slice(0, 10), balance: Math.round(consumed - burned) })
  }

  return { avgBalance7d: Math.round(days.reduce((s, d) => s + d.balance, 0) / 7), days }
}

export interface BodyBatteryTrend {
  avg7d: number | null
  avgPrev7d: number | null
  deltaPct: number | null
}

/** Moyenne mobile 7j du Body Battery vs les 7 jours précédents. */
export async function computeBodyBatteryTrend(): Promise<BodyBatteryTrend> {
  const db = await getDb()
  const all = await db.getAll('recovery')
  const now = Date.now()
  const in7 = all.filter((c) => now - new Date(c.date).getTime() <= 7 * 86_400_000)
  const in14to7 = all.filter((c) => {
    const age = now - new Date(c.date).getTime()
    return age > 7 * 86_400_000 && age <= 14 * 86_400_000
  })
  const avg7d = in7.length ? Math.round(in7.reduce((s, c) => s + c.bodyBatteryScore, 0) / in7.length) : null
  const avgPrev7d = in14to7.length ? Math.round(in14to7.reduce((s, c) => s + c.bodyBatteryScore, 0) / in14to7.length) : null
  const deltaPct = avg7d != null && avgPrev7d != null && avgPrev7d > 0 ? Math.round(((avg7d - avgPrev7d) / avgPrev7d) * 100) : null
  return { avg7d, avgPrev7d, deltaPct }
}
