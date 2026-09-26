import { describe, expect, it } from 'vitest'
import { FEMALE, PROFILE } from '../test/fixtures'
import {
  bmiCategory,
  bmrShareForDuration,
  computeBmi,
  computeBmr,
  computeCaloriesForUser,
  computeCaloriesFromHr,
  computeCaloriesFromPhaseLog,
  computeCaloriesFromSteps,
} from './met'

describe('BMR (Mifflin-St Jeor)', () => {
  it('homme 30 ans, 75 kg, 175 cm', () => expect(computeBmr(PROFILE)).toBe(1699))
  it('femme 30 ans, 60 kg, 165 cm', () => expect(computeBmr(FEMALE)).toBe(1320)) // 600 + 1031,25 - 150 - 161
})

describe('calories MET', () => {
  it('MET × poids × heures', () => expect(computeCaloriesForUser(5, 60, PROFILE)).toBe(375))
  it('applique le facteur 0,95 pour une femme', () => expect(computeCaloriesForUser(5, 60, { ...PROFILE, sex: 'femme' })).toBe(356))
  it('durée nulle = 0 kcal', () => expect(computeCaloriesForUser(8, 0, PROFILE)).toBe(0))
})

describe('part de BMR retirée pour la marche', () => {
  it('proportionnelle à la durée sur 24 h', () => {
    expect(bmrShareForDuration(720, PROFILE)).toBe(850)
    expect(bmrShareForDuration(0, PROFILE)).toBe(0)
    expect(bmrShareForDuration(1440, PROFILE)).toBe(computeBmr(PROFILE))
  })
})

describe('calories à partir des pas (NEAT)', () => {
  it('0,0005 kcal par pas et par kg', () => expect(computeCaloriesFromSteps(10_000, PROFILE)).toBe(375))
  it('reste bien en dessous du BMR (le bug Google Fit affichait ~1800 kcal)', () => {
    expect(computeCaloriesFromSteps(20_000, PROFILE)).toBeLessThan(computeBmr(PROFILE))
  })
})

describe('calories via FC (Keytel)', () => {
  it('ignore une FC moyenne sous 90 bpm (formule invalide)', () => expect(computeCaloriesFromHr(85, 60, PROFILE)).toBeNull())
  it('homme, 140 bpm, 60 min', () => expect(computeCaloriesFromHr(140, 60, PROFILE)).toBe(777))
  it('ne renvoie jamais un nombre négatif', () => {
    expect(computeCaloriesFromHr(90, 60, { ...FEMALE, bodyWeightKg: 200 })).toBeGreaterThanOrEqual(0)
  })
})

describe('calories phase par phase', () => {
  it('intègre la durée RÉELLE de chaque phase', () => {
    const kcal = computeCaloriesFromPhaseLog(
      [
        { intensity: 'facile', actualSec: 300 }, // 4 × 75 × 5/60 = 25
        { intensity: 'dur', actualSec: 60 }, // 11 × 75 × 1/60 = 13,75
      ],
      PROFILE,
    )
    expect(kcal).toBe(39)
  })
  it('liste vide = 0', () => expect(computeCaloriesFromPhaseLog([], PROFILE)).toBe(0))
})

describe('IMC', () => {
  it('75 kg / 175 cm', () => expect(computeBmi(PROFILE)).toBe(24.5))
  it('catégories OMS aux bornes', () => {
    expect(bmiCategory(18.4)).toBe('insuffisance pondérale')
    expect(bmiCategory(18.5)).toBe('corpulence normale')
    expect(bmiCategory(25)).toBe('surpoids')
    expect(bmiCategory(30)).toBe('obésité')
  })
})
