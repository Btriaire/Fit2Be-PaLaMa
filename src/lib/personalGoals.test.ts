import { describe, expect, it } from 'vitest'
import { sessionsGoalFromWeeks, stepsGoalFromHistory } from './personalGoals'

describe('objectif de pas calibré', () => {
  it('générique (null) sous 7 jours de données', () => expect(stepsGoalFromHistory([8000, 9000, 7000])).toBeNull())
  it('médiane × 1,1 arrondie à 500', () => {
    // médiane 8 000 -> 8 800 -> 9 000
    expect(stepsGoalFromHistory([6000, 7000, 7500, 8000, 8500, 9000, 12_000])).toBe(9000)
  })
  it('plancher de 6 000 pour un profil très sédentaire', () => expect(stepsGoalFromHistory(Array(10).fill(2000))).toBe(6000))
  it('plafond de 12 000', () => expect(stepsGoalFromHistory(Array(10).fill(20_000))).toBe(12_000))
  it('ignore les jours à 0 pas (téléphone oublié)', () => {
    expect(stepsGoalFromHistory([0, 0, 8000, 8000, 8000, 8000, 8000, 8000, 8000])).toBe(9000)
  })
})

describe('objectif de séances calibré', () => {
  it('null sans historique exploitable', () => {
    expect(sessionsGoalFromWeeks([0, 0, 0, 0])).toBeNull()
    expect(sessionsGoalFromWeeks([3])).toBeNull()
  })
  it('moyenne + 0,5, arrondie', () => {
    expect(sessionsGoalFromWeeks([3, 3, 3, 3])).toBe(4)
    expect(sessionsGoalFromWeeks([2, 2, 2, 2])).toBe(3)
    expect(sessionsGoalFromWeeks([1, 0, 1, 0])).toBe(2) // plancher
  })
  it('plafond à 6', () => expect(sessionsGoalFromWeeks([7, 7, 7, 7])).toBe(6))
})
