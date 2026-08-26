// Charge d'entraînement du jour et recommandation de récupération, basées sur
// la méthode "session-RPE" (Foster, 2001) : charge = effort ressenti (0-10) x
// durée (min). L'effort ressenti est dérivé du meilleur signal disponible par
// séance — zone de FC réelle en priorité, sinon les METs de l'activité, sinon
// le RPE saisi manuellement sur les séries de musculation.

import { getDb } from './db'
import { getAllWorkouts } from './workouts'
import { getEnduranceSessions, ENDURANCE_ACTIVITY_META } from './endurance'
import { computeMaxHr } from './heartRate'
import { GYM_WORKOUT_MET } from './met'
import { isToday } from './date'
import type { ActivityLog, EnduranceSession, Workout } from '../types'

export type RecoveryBand = 'aucune' | 'légère' | 'modérée' | 'importante' | 'intense'

export interface SessionLoad {
  source: 'gym' | 'activity' | 'endurance'
  label: string
  durationMin: number
  effortScore: number // 0-10, équivalent RPE
  load: number // effortScore x durée
  hrPct: number | null // % de FC max atteint (moyenne ou pic), si connu
}

export interface DailyRecovery {
  totalLoad: number
  sessions: SessionLoad[]
  band: RecoveryBand
  hint: string
  bodyBatteryPenalty: number
  peakHrPct: number | null
  weeklyAvgLoad: number
}

/** FC moyenne → effort ressenti, via les mêmes seuils de zone que le reste de
 * l'app (60/70/80/90% FC max) — Z1≈RPE3, Z5≈RPE9. */
function effortFromHr(avgHr: number, ageYears: number): number {
  const pct = (avgHr / computeMaxHr(ageYears)) * 100
  if (pct < 60) return 3
  if (pct < 70) return 4.5
  if (pct < 80) return 6
  if (pct < 90) return 7.5
  return 9
}

/** MET → effort ressenti, échelle linéaire recalée sur MET 12 (course
 * soutenue) = RPE 10, MET 2.5 (étirements) = RPE 2. */
function effortFromMet(met: number): number {
  return Math.max(1, Math.min(10, met / 1.2))
}

function effortFromRpe(rpe: number): number {
  return Math.max(0, Math.min(10, rpe))
}

const BAND_THRESHOLDS: Array<{ max: number; band: RecoveryBand; penalty: number; hint: string }> = [
  { max: 0, band: 'aucune', penalty: 0, hint: "Pas d'effort enregistré aujourd'hui — récupération naturelle." },
  { max: 150, band: 'légère', penalty: 5, hint: 'Charge légère. Une bonne nuit de sommeil suffit à récupérer.' },
  { max: 300, band: 'modérée', penalty: 12, hint: 'Charge modérée. Prévois ~24h avant un effort intense similaire.' },
  { max: 450, band: 'importante', penalty: 20, hint: 'Charge importante. Privilégie une séance légère ou du repos demain.' },
  { max: Infinity, band: 'intense', penalty: 30, hint: 'Effort très soutenu. Recommandé : 48h de récupération avant de repousser aussi fort, et priorise le sommeil ce soir.' },
]

function bandFor(totalLoad: number) {
  return BAND_THRESHOLDS.find((b) => totalLoad <= b.max)!
}

function gymSessionLoad(w: Workout): SessionLoad | null {
  if (!w.finishedAt) return null
  const durationMin = Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60000))
  const rpes = w.exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup && s.rpe != null).map((s) => s.rpe!))
  const effortScore = rpes.length > 0 ? effortFromRpe(rpes.reduce((a, b) => a + b, 0) / rpes.length) : effortFromMet(GYM_WORKOUT_MET)
  return {
    source: 'gym',
    label: w.name,
    durationMin,
    effortScore: Math.round(effortScore * 10) / 10,
    load: Math.round(effortScore * durationMin),
    hrPct: null,
  }
}

function activitySessionLoad(a: ActivityLog): SessionLoad {
  const effortScore = effortFromMet(a.metValue)
  return {
    source: 'activity',
    label: a.label,
    durationMin: a.durationMin,
    effortScore: Math.round(effortScore * 10) / 10,
    load: Math.round(effortScore * a.durationMin),
    hrPct: null,
  }
}

export function enduranceSessionLoad(s: EnduranceSession, ageYears: number, label: string): SessionLoad {
  const maxHr = computeMaxHr(ageYears)
  const peakHr = s.machineStats?.peakHeartRate ?? s.avgHeartRate ?? null
  const hrPct = peakHr ? Math.round((peakHr / maxHr) * 100) : null
  let effortScore: number
  if (s.avgHeartRate) effortScore = effortFromHr(s.avgHeartRate, ageYears)
  else if (s.machineStats?.avgMets) effortScore = effortFromMet(s.machineStats.avgMets)
  else effortScore = effortFromMet(6) // effort cardio non qualifié, hypothèse modérée
  return {
    source: 'endurance',
    label,
    durationMin: s.durationMin,
    effortScore: Math.round(effortScore * 10) / 10,
    load: Math.round(effortScore * s.durationMin),
    hrPct,
  }
}

function dailyLoadFor(
  dayFilter: (ts: number) => boolean,
  ageYears: number,
  workouts: Workout[],
  activities: ActivityLog[],
  endurance: EnduranceSession[],
): number {
  let total = 0
  for (const w of workouts.filter((w) => w.finishedAt && dayFilter(w.startedAt))) {
    total += gymSessionLoad(w)?.load ?? 0
  }
  for (const a of activities.filter((a) => dayFilter(a.loggedAt))) {
    total += activitySessionLoad(a).load
  }
  for (const e of endurance.filter((e) => dayFilter(e.startedAt))) {
    total += enduranceSessionLoad(e, ageYears, ENDURANCE_ACTIVITY_META[e.activityType].label).load
  }
  return total
}

export async function computeDailyRecovery(ageYears: number): Promise<DailyRecovery> {
  const [workouts, endurance, db] = await Promise.all([getAllWorkouts(), getEnduranceSessions(), getDb()])
  const activities = await db.getAll('activities')

  const sessions: SessionLoad[] = []
  for (const w of workouts.filter((w) => w.finishedAt && isToday(w.startedAt))) {
    const s = gymSessionLoad(w)
    if (s) sessions.push(s)
  }
  for (const a of activities.filter((a) => isToday(a.loggedAt))) {
    sessions.push(activitySessionLoad(a))
  }
  for (const e of endurance.filter((e) => isToday(e.startedAt))) {
    sessions.push(enduranceSessionLoad(e, ageYears, ENDURANCE_ACTIVITY_META[e.activityType].label))
  }

  const totalLoad = sessions.reduce((s, x) => s + x.load, 0)
  const peakHrPct = sessions.reduce<number | null>((max, s) => (s.hrPct != null ? Math.max(max ?? 0, s.hrPct) : max), null)
  const { band, penalty, hint } = bandFor(totalLoad)

  // Moyenne des 7 derniers jours (aujourd'hui exclu) pour donner du contexte.
  let weeklySum = 0
  for (let i = 1; i <= 7; i++) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = dayStart.getTime() + 24 * 3600_000
    weeklySum += dailyLoadFor((ts) => ts >= dayStart.getTime() && ts < dayEnd, ageYears, workouts, activities, endurance)
  }

  return {
    totalLoad: Math.round(totalLoad),
    sessions: sessions.sort((a, b) => b.load - a.load),
    band,
    hint,
    bodyBatteryPenalty: penalty,
    peakHrPct,
    weeklyAvgLoad: Math.round(weeklySum / 7),
  }
}
