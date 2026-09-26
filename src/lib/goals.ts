import type { WeightLog } from '../types'
import type { Goal, Settings } from './settings'

const DAY = 86_400_000

/** Protéines (g/kg/j) : 1,6 est le seuil au-delà duquel le gain est marginal (Morton 2018, méta-analyse) ; on vise plus haut en déficit pour préserver la masse maigre. */
const PROTEIN_PER_KG: Record<Goal, number> = { perte: 2.0, maintien: 1.6, prise: 1.8 }

export interface ProteinTarget {
  perKg: number
  targetG: number
  minG: number
}

export function proteinTarget(settings: Pick<Settings, 'bodyWeightKg' | 'goal'>): ProteinTarget {
  const perKg = PROTEIN_PER_KG[settings.goal]
  return { perKg, targetG: Math.round(settings.bodyWeightKg * perKg), minG: Math.round(settings.bodyWeightKg * 1.6) }
}

/**
 * Tendance du poids en kg/semaine : pente de la régression linéaire sur les `days`
 * derniers jours. Il faut au moins 3 pesées réparties sur 7 jours, sinon null.
 */
export function weightTrendKgPerWeek(logs: WeightLog[], now = Date.now(), days = 28): number | null {
  const pts = logs.filter((l) => l.loggedAt >= now - days * DAY && l.loggedAt <= now).sort((a, b) => a.loggedAt - b.loggedAt)
  if (pts.length < 3 || pts[pts.length - 1].loggedAt - pts[0].loggedAt < 7 * DAY) return null
  const xs = pts.map((p) => (p.loggedAt - pts[0].loggedAt) / DAY)
  const ys = pts.map((p) => p.weightKg)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (den === 0) return null
  const slopePerDay = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den
  return Math.round(slopePerDay * 7 * 100) / 100
}

export type GoalStatus = 'reached' | 'on-track' | 'too-slow' | 'too-fast' | 'wrong-direction' | 'no-data'

export interface GoalAssessment {
  startKg: number
  currentKg: number
  targetKg: number
  progressPct: number
  actualRate: number | null
  requiredRate: number | null
  safeRate: { min: number; max: number }
  projectedDate: string | null
  status: GoalStatus
  message: string
}

const fmt = (n: number) => String(Math.round(Math.abs(n) * 100) / 100).replace('.', ',')

function toDateStr(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Où en est l'objectif de poids : progression, rythme réel vs rythme nécessaire, et
 * garde-fou sur la vitesse (perte : 0,5 à 1 % du poids par semaine ; prise : 0,25 à 0,5 %).
 */
export function assessGoal(
  settings: Pick<Settings, 'bodyWeightKg' | 'targetWeightKg' | 'targetDate'>,
  logs: WeightLog[],
  now = Date.now(),
): GoalAssessment | null {
  const target = settings.targetWeightKg
  if (target == null || !(target > 0)) return null
  const sorted = [...logs].sort((a, b) => a.loggedAt - b.loggedAt)
  const current = sorted.length ? sorted[sorted.length - 1].weightKg : settings.bodyWeightKg
  const start = sorted.length ? sorted[0].weightKg : current
  const delta = target - current
  const losing = delta < 0
  const bw = current
  const safeRate = losing ? { min: bw * 0.005, max: bw * 0.01 } : { min: bw * 0.0025, max: bw * 0.005 }
  const actualRate = weightTrendKgPerWeek(logs, now)

  const denom = start - target
  const progressPct = Math.abs(denom) < 0.05 ? 100 : Math.max(0, Math.min(100, Math.round(((start - current) / denom) * 100)))

  let requiredRate: number | null = null
  if (settings.targetDate) {
    const weeksLeft = Math.max(0.1, (new Date(`${settings.targetDate}T12:00:00`).getTime() - now) / (7 * DAY))
    requiredRate = Math.round((delta / weeksLeft) * 100) / 100
  }

  const base = { startKg: start, currentKg: current, targetKg: target, progressPct, actualRate, requiredRate, safeRate }

  if (Math.abs(delta) <= 0.3) return { ...base, progressPct: 100, projectedDate: null, status: 'reached', message: 'Objectif atteint. Bravo !' }

  let projectedDate: string | null = null
  if (actualRate != null && Math.sign(actualRate) === Math.sign(delta) && Math.abs(actualRate) >= 0.05) {
    projectedDate = toDateStr(now + (delta / actualRate) * 7 * DAY)
  }

  if (requiredRate != null && Math.abs(requiredRate) > safeRate.max * 1.15) {
    return {
      ...base,
      projectedDate,
      status: 'too-fast',
      message: `Ta date exige ${fmt(requiredRate)} kg/semaine, au-dessus du rythme sûr (~${fmt(safeRate.max)} kg/semaine). Repousse l'échéance.`,
    }
  }
  if (actualRate == null) {
    return { ...base, projectedDate: null, status: 'no-data', message: 'Pèse-toi 3 fois sur 7 jours pour voir ton rythme réel.' }
  }
  if (Math.sign(actualRate) !== Math.sign(delta) && Math.abs(actualRate) >= 0.1) {
    return { ...base, projectedDate, status: 'wrong-direction', message: `Ton poids évolue dans le mauvais sens (${actualRate > 0 ? '+' : '−'}${fmt(actualRate)} kg/semaine).` }
  }
  if (requiredRate != null && Math.abs(actualRate) < Math.abs(requiredRate) * 0.6) {
    return { ...base, projectedDate, status: 'too-slow', message: `Rythme actuel ${fmt(actualRate)} kg/semaine pour ${fmt(requiredRate)} nécessaires.` }
  }
  if (Math.abs(actualRate) > safeRate.max * 1.3 && losing) {
    return { ...base, projectedDate, status: 'too-fast', message: `Tu perds ${fmt(actualRate)} kg/semaine, plus vite que le rythme sûr : mange un peu plus pour préserver ta masse musculaire.` }
  }
  return { ...base, projectedDate, status: 'on-track', message: `Bon rythme : ${fmt(actualRate)} kg/semaine.` }
}
