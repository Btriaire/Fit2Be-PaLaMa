import { describe, expect, it } from 'vitest'
import { computePaceMinPerKm, formatPace } from './endurance'
import { PROFILE } from '../test/fixtures'

describe('allure', () => {
  it('min/km = durée / distance', () => expect(computePaceMinPerKm(30, 5)).toBe(6))
  it('sans distance, pas d’allure', () => {
    expect(computePaceMinPerKm(30, 0)).toBeNull()
    expect(computePaceMinPerKm(30, -1)).toBeNull()
  })
  it('formate mm:ss/km', () => expect(formatPace(6.5)).toBe('6:30/km'))
  it('ne produit jamais « :60 » (arrondi de secondes)', () => {
    expect(formatPace(5.9999)).toBe('6:00/km')
    expect(formatPace(4.9917)).toMatch(/^(4:59|5:00)\/km$/)
  })
})

describe('correction a posteriori de la zone et du programme', () => {
  it('une zone choisie à la main prime sur la FC moyenne ; le programme est gardé', async () => {
    const { getDb } = await import('./db')
    const { updateEnduranceSession } = await import('./endurance')
    const db = await getDb()
    await db.put('endurance', { id: 'iv', activityType: 'velo-appart', startedAt: 1, durationMin: 40, caloriesBurned: 300, avgHeartRate: 125, hrZone: 2 })
    const out = await updateEnduranceSession(
      'iv',
      { activityType: 'velo-appart', startedAt: 1, durationMin: 40, caloriesBurned: 300, avgHeartRate: 125, hrZone: 3, programId: 'velo-norvegien' },
      PROFILE,
    )
    expect(out?.hrZone).toBe(3)
    expect(out?.programId).toBe('velo-norvegien')
  })
})
