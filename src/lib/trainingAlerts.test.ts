import { describe, expect, it } from 'vitest'
import { deloadAlerts, detectPlateau } from './trainingAlerts'
import type { Acwr, TrainingMonotony } from './recovery'

const acwr = (ratio: number | null): Acwr => ({ acute: 300, chronic: 250, ratio, risk: 'optimal' })
const mono = (risk: TrainingMonotony['risk']): TrainingMonotony => ({ weeklyLoad: 1000, meanDailyLoad: 140, stdDev: 20, monotony: 1.2, strain: 1200, risk })

describe('plateau', () => {
  it('a besoin d’au moins 5 séances', () => expect(detectPlateau([100, 100, 100, 100])).toBe(false))
  it('détecte 3 séances sans progrès', () => expect(detectPlateau([90, 95, 100, 99, 100, 100])).toBe(true))
  it('pas de plateau si la progression continue', () => expect(detectPlateau([90, 92, 95, 98, 101, 104])).toBe(false))
  it('tolère 1 % de bruit mais pas plus', () => {
    expect(detectPlateau([100, 100, 100, 100, 100, 100.9])).toBe(true)
    expect(detectPlateau([100, 100, 100, 100, 100, 102])).toBe(false)
  })
})

describe('alertes de décharge', () => {
  it('ACWR > 1,5 : décharge conseillée', () => {
    const a = deloadAlerts(acwr(1.62), mono('faible'))
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ id: 'deload-acwr', level: 'warn' })
    expect(a[0].detail).toContain('1,62')
  })
  it('ACWR entre 1,3 et 1,5 : simple information', () => {
    expect(deloadAlerts(acwr(1.4), mono('faible'))[0]).toMatchObject({ id: 'load-rising', level: 'info' })
  })
  it('ACWR normal ou masqué : rien', () => {
    expect(deloadAlerts(acwr(1.0), mono('faible'))).toHaveLength(0)
    expect(deloadAlerts(acwr(null), mono('faible'))).toHaveLength(0)
  })
  it('monotonie élevée : alerte dédiée', () => {
    expect(deloadAlerts(acwr(1.0), mono('élevé')).map((x) => x.id)).toEqual(['deload-monotony'])
  })
})
