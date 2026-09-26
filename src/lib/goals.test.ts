import { describe, expect, it } from 'vitest'
import type { WeightLog } from '../types'
import { assessGoal, proteinTarget, weightTrendKgPerWeek } from './goals'

const DAY = 86_400_000
const NOW = new Date('2026-09-26T12:00:00').getTime()
const logs = (points: Array<[number, number]>): WeightLog[] =>
  points.map(([daysAgo, weightKg], i) => ({ id: `w${i}`, loggedAt: NOW - daysAgo * DAY, weightKg }))

describe('protéines', () => {
  it('2 g/kg en perte, 1,6 en maintien, 1,8 en prise', () => {
    expect(proteinTarget({ bodyWeightKg: 80, goal: 'perte' }).targetG).toBe(160)
    expect(proteinTarget({ bodyWeightKg: 80, goal: 'maintien' }).targetG).toBe(128)
    expect(proteinTarget({ bodyWeightKg: 80, goal: 'prise' }).targetG).toBe(144)
  })
  it('le minimum reste 1,6 g/kg quel que soit l’objectif', () => {
    expect(proteinTarget({ bodyWeightKg: 80, goal: 'perte' }).minG).toBe(128)
  })
})

describe('tendance de poids', () => {
  it('perte régulière de 0,5 kg/semaine', () => {
    const t = weightTrendKgPerWeek(logs([[28, 82], [21, 81.5], [14, 81], [7, 80.5], [0, 80]]), NOW)
    expect(t).toBe(-0.5)
  })
  it('null sous 3 pesées ou sur moins de 7 jours', () => {
    expect(weightTrendKgPerWeek(logs([[10, 80], [0, 79.5]]), NOW)).toBeNull()
    expect(weightTrendKgPerWeek(logs([[5, 80], [3, 79.8], [0, 79.5]]), NOW)).toBeNull()
  })
  it('ignore les pesées hors fenêtre de 28 jours', () => {
    expect(weightTrendKgPerWeek(logs([[90, 95], [10, 80], [5, 80], [0, 80]]), NOW)).toBe(0)
  })
})

describe('objectif de poids', () => {
  const s = (target?: number, date?: string) => ({ bodyWeightKg: 80, targetWeightKg: target, targetDate: date })

  it('pas d’objectif : null', () => expect(assessGoal(s(), [], NOW)).toBeNull())

  it('objectif atteint à 300 g près', () => {
    expect(assessGoal(s(79.8), logs([[0, 80]]), NOW)?.status).toBe('reached')
  })

  it('date irréaliste : trop rapide (au-dessus de 1 %/semaine)', () => {
    // 10 kg en 4 semaines = 2,5 kg/semaine
    const a = assessGoal(s(70, '2026-10-24'), logs([[0, 80]]), NOW)!
    expect(a.status).toBe('too-fast')
    expect(a.requiredRate).toBeCloseTo(-2.5, 1)
  })

  it('sans assez de pesées : demande des données', () => {
    expect(assessGoal(s(75, '2027-03-01'), logs([[0, 80]]), NOW)?.status).toBe('no-data')
  })

  it('bon rythme + date de fin estimée', () => {
    const a = assessGoal(s(76), logs([[28, 82], [21, 81.5], [14, 81], [7, 80.5], [0, 80]]), NOW)!
    expect(a.status).toBe('on-track')
    expect(a.actualRate).toBe(-0.5)
    expect(a.projectedDate).toBe('2026-11-21') // 4 kg à 0,5 kg/semaine = 8 semaines
    expect(a.progressPct).toBe(33) // 2 kg sur 6 kg
  })

  it('poids qui monte alors qu’on veut perdre', () => {
    const a = assessGoal(s(75), logs([[28, 78], [21, 78.6], [14, 79.2], [7, 79.8], [0, 80.4]]), NOW)!
    expect(a.status).toBe('wrong-direction')
  })

  it('trop lent par rapport à l’échéance', () => {
    // il faut ~0,83 kg/sem (5 kg en 6 sem), on fait 0,2
    const a = assessGoal(s(75, '2026-11-07'), logs([[28, 80.8], [21, 80.6], [14, 80.4], [7, 80.2], [0, 80]]), NOW)!
    expect(a.status).toBe('too-slow')
  })
})
