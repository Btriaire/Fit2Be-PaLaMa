import { describe, expect, it } from 'vitest'
import { computePaceMinPerKm, formatPace } from './endurance'

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
