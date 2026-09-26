import { describe, expect, it } from 'vitest'
import { FEMALE, PROFILE } from '../test/fixtures'
import { adjustmentFor, effectiveCalorieTarget, targetFromProfile } from './calorieTarget'

describe('cible calorique calculée', () => {
  it('maintien : BMR × 1,15 sans ajustement', () => {
    const t = targetFromProfile({ ...PROFILE, goal: 'maintien', calorieMode: 'auto' })
    expect(t.bmr).toBe(1699)
    expect(t.baseline).toBe(1954)
    expect(t.adjustment).toBe(0)
    expect(t.target).toBe(1954)
  })

  it('perte : déficit de 20 % borné entre 300 et 600 kcal', () => {
    expect(adjustmentFor('perte', 1954)).toBe(-391)
    expect(adjustmentFor('perte', 1000)).toBe(-300)
    expect(adjustmentFor('perte', 4000)).toBe(-600)
  })

  it('prise : excédent de 10 % borné entre 200 et 400 kcal', () => {
    expect(adjustmentFor('prise', 1954)).toBe(200)
    expect(adjustmentFor('prise', 3900)).toBe(390)
    expect(adjustmentFor('prise', 6000)).toBe(400)
  })

  it('ne descend jamais sous le plancher (1200 femme, 1500 homme)', () => {
    const tiny = { ...FEMALE, bodyWeightKg: 40, heightCm: 150, ageYears: 60, goal: 'perte' as const }
    expect(targetFromProfile(tiny).target).toBeGreaterThanOrEqual(1200)
    const smallMan = { ...PROFILE, bodyWeightKg: 45, heightCm: 160, ageYears: 70, goal: 'perte' as const }
    expect(targetFromProfile(smallMan).target).toBeGreaterThanOrEqual(1500)
  })

  it('mode manuel : renvoie la valeur saisie', () => {
    const t = effectiveCalorieTarget({ ...PROFILE, calorieMode: 'manual', dailyCalorieTarget: 2600 })
    expect(t.target).toBe(2600)
    expect(t.mode).toBe('manual')
  })

  it('mode auto : ignore dailyCalorieTarget', () => {
    const t = effectiveCalorieTarget({ ...PROFILE, calorieMode: 'auto', goal: 'perte', dailyCalorieTarget: 9999 })
    expect(t.target).toBe(1563)
    expect(t.mode).toBe('auto')
  })
})
