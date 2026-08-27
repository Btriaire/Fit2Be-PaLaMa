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

// ---- ACWR (Acute:Chronic Workload Ratio) ----

export type AcwrRisk = 'sous-charge' | 'optimal' | 'à surveiller' | 'risque élevé'

export interface Acwr {
  acute: number // charge moyenne des 7 derniers jours
  chronic: number // charge moyenne des 28 derniers jours
  ratio: number | null // acute / chronic
  risk: AcwrRisk
}

/** Ratio charge aiguë (7j) / charge chronique (28j) — un des indicateurs les
 * mieux établis en sciences du sport pour repérer un risque de blessure par
 * surcharge relative (Gabbett, 2016). Zone saine ≈ 0.8-1.3 ; >1.5 = risque
 * élevé ; <0.8 = perte de forme progressive plutôt qu'un risque immédiat. */
export async function computeAcwr(ageYears: number): Promise<Acwr> {
  const [workouts, endurance, db] = await Promise.all([getAllWorkouts(), getEnduranceSessions(), getDb()])
  const activities = await db.getAll('activities')

  const dailyLoads: number[] = []
  for (let i = 0; i < 28; i++) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = dayStart.getTime() + 24 * 3600_000
    dailyLoads.push(dailyLoadFor((ts) => ts >= dayStart.getTime() && ts < dayEnd, ageYears, workouts, activities, endurance))
  }

  const acute = dailyLoads.slice(0, 7).reduce((a, b) => a + b, 0) / 7
  const chronic = dailyLoads.reduce((a, b) => a + b, 0) / 28
  // En dessous de ce seuil, le ratio existe mathématiquement mais n'est pas
  // interprétable (trop peu d'entraînement chronique pour que la comparaison
  // ait un sens) — on le masque plutôt que d'afficher un chiffre trompeur.
  const hasEnoughHistory = chronic >= 50
  const ratio = hasEnoughHistory && chronic > 0 ? acute / chronic : null

  let risk: AcwrRisk = 'optimal'
  if (ratio === null) risk = 'optimal'
  else if (ratio > 1.5) risk = 'risque élevé'
  else if (ratio > 1.3) risk = 'à surveiller'
  else if (ratio < 0.8) risk = 'sous-charge'

  return { acute: Math.round(acute), chronic: Math.round(chronic), ratio: ratio != null ? Math.round(ratio * 100) / 100 : null, risk }
}

// ---- Dette de sommeil ----

export interface SleepDebt {
  totalDebtMin: number // somme des manques sur les jours avec donnée
  daysWithData: number
  avgSleepMin: number | null
}

/** Somme des écarts (objectif - sommeil réel) sur les 7 derniers jours où une
 * donnée Google Fit existe — jours sans donnée simplement ignorés. */
export async function computeSleepDebt(sleepTargetMin: number): Promise<SleepDebt> {
  const db = await getDb()
  let totalDebt = 0
  let daysWithData = 0
  let sleepSum = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const day = await db.get('googleFitDaily', dateStr)
    if (day?.sleepMinutes == null) continue
    daysWithData++
    sleepSum += day.sleepMinutes
    totalDebt += Math.max(0, sleepTargetMin - day.sleepMinutes)
  }
  return { totalDebtMin: totalDebt, daysWithData, avgSleepMin: daysWithData > 0 ? Math.round(sleepSum / daysWithData) : null }
}

// ---- Streak d'activité ----

export interface ActivityStreak {
  activeDaysStreak: number // jours consécutifs (jusqu'à aujourd'hui) avec au moins une séance
  restDaysStreak: number // jours consécutifs sans aucune séance (0 si actif aujourd'hui)
}

export async function computeActivityStreak(ageYears: number): Promise<ActivityStreak> {
  const [workouts, endurance, db] = await Promise.all([getAllWorkouts(), getEnduranceSessions(), getDb()])
  const activities = await db.getAll('activities')

  function loadOnDay(daysAgo: number): number {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - daysAgo)
    const dayEnd = dayStart.getTime() + 24 * 3600_000
    return dailyLoadFor((ts) => ts >= dayStart.getTime() && ts < dayEnd, ageYears, workouts, activities, endurance)
  }

  let activeDaysStreak = 0
  for (let i = 0; i < 60; i++) {
    if (loadOnDay(i) > 0) activeDaysStreak++
    else break
  }
  let restDaysStreak = 0
  if (activeDaysStreak === 0) {
    for (let i = 0; i < 60; i++) {
      if (loadOnDay(i) === 0) restDaysStreak++
      else break
    }
  }
  return { activeDaysStreak, restDaysStreak }
}

// ---- Readiness du matin ----

export interface Readiness {
  score: number // 0-100
  loadComponent: number
  sleepComponent: number | null
  subjectiveComponent: number
}

/** Score "prêt à performer aujourd'hui", distinct du Body Battery (qui mélange
 * check-in + charge du jour même) — combine la charge d'hier, le sommeil de
 * cette nuit (si connu via Google Fit) et le ressenti subjectif du jour. */
export async function computeReadiness(ageYears: number, subjectiveScore: number, sleepTargetMin: number): Promise<Readiness> {
  const [workouts, endurance, db] = await Promise.all([getAllWorkouts(), getEnduranceSessions(), getDb()])
  const activities = await db.getAll('activities')

  const yesterdayStart = new Date()
  yesterdayStart.setHours(0, 0, 0, 0)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayEnd = yesterdayStart.getTime() + 24 * 3600_000
  const yesterdayLoad = dailyLoadFor((ts) => ts >= yesterdayStart.getTime() && ts < yesterdayEnd, ageYears, workouts, activities, endurance)
  const { penalty } = bandFor(yesterdayLoad)
  const loadComponent = Math.round(100 - (penalty / 30) * 100)

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayFit = await db.get('googleFitDaily', todayStr)
  const sleepComponent = todayFit?.sleepMinutes != null ? Math.round(Math.min(100, (todayFit.sleepMinutes / sleepTargetMin) * 100)) : null

  const score = Math.round(
    sleepComponent != null
      ? loadComponent * 0.35 + sleepComponent * 0.35 + subjectiveScore * 0.3
      : loadComponent * 0.5 + subjectiveScore * 0.5,
  )

  return { score: Math.max(0, Math.min(100, score)), loadComponent, sleepComponent, subjectiveComponent: subjectiveScore }
}

// ---- Monotonie & Contrainte (Foster, 2001) ----

export type MonotonyRisk = 'faible' | 'modéré' | 'élevé'

export interface TrainingMonotony {
  weeklyLoad: number // somme des charges journalières (session-RPE) des 7 derniers jours
  meanDailyLoad: number
  stdDev: number
  monotony: number // moyenne / écart-type — mesure le manque de variation de la charge jour après jour
  strain: number // charge hebdo x monotonie — combiné, prédit le risque de surentraînement/blessure/maladie
  risk: MonotonyRisk
}

/** Complète l'ACWR (surcharge relative) par la monotonie de l'entraînement :
 * une charge répétée sans variation jour après jour (même si le volume total
 * est raisonnable) est elle-même un facteur de risque indépendant identifié
 * par Foster (1998, 2001) chez des athlètes d'endurance — d'où le calcul
 * séparé plutôt qu'une simple relecture de l'ACWR. */
export async function computeTrainingMonotony(ageYears: number): Promise<TrainingMonotony> {
  const [workouts, endurance, db] = await Promise.all([getAllWorkouts(), getEnduranceSessions(), getDb()])
  const activities = await db.getAll('activities')

  const dailyLoads: number[] = []
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = dayStart.getTime() + 24 * 3600_000
    dailyLoads.push(dailyLoadFor((ts) => ts >= dayStart.getTime() && ts < dayEnd, ageYears, workouts, activities, endurance))
  }

  const weeklyLoad = dailyLoads.reduce((a, b) => a + b, 0)
  const meanDailyLoad = weeklyLoad / 7
  const variance = dailyLoads.reduce((sum, l) => sum + (l - meanDailyLoad) ** 2, 0) / 7
  const stdDev = Math.sqrt(variance)
  // Écart-type nul (aucune variation, y compris 7 jours de repos) -> pas de
  // signal exploitable, on affiche une monotonie neutre plutôt qu'une
  // division par zéro.
  const monotony = stdDev > 0 ? meanDailyLoad / stdDev : 0
  const strain = weeklyLoad * monotony

  let risk: MonotonyRisk = 'faible'
  if (monotony > 2 && strain > 6000) risk = 'élevé'
  else if (monotony > 1.5 || strain > 4000) risk = 'modéré'

  return {
    weeklyLoad: Math.round(weeklyLoad),
    meanDailyLoad: Math.round(meanDailyLoad),
    stdDev: Math.round(stdDev * 10) / 10,
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(strain),
    risk,
  }
}
