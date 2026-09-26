import { describe, expect, it } from 'vitest'
import { incrementFor, parseRepRange, suggestNextLoad, type SessionSets } from './loadProgression'

const session = (sets: Array<[number, number, number?]>, date = 1): SessionSets => ({
  date,
  sets: sets.map(([weightKg, reps, rpe]) => ({ weightKg, reps, rpe })),
})

describe('fourchette de reps', () => {
  it('lit "8-10"', () => expect(parseRepRange('8-10')).toEqual({ lo: 8, hi: 10 }))
  it('un seul chiffre = cible + 2 de marge', () => expect(parseRepRange('12')).toEqual({ lo: 12, hi: 14 }))
  it('AMRAP ou vide = 8-12 par défaut', () => {
    expect(parseRepRange('AMRAP')).toEqual({ lo: 8, hi: 12 })
    expect(parseRepRange(undefined)).toEqual({ lo: 8, hi: 12 })
  })
})

describe('incréments', () => {
  it('barre / machine 2,5 kg, haltère 2 kg, poids du corps 0', () => {
    expect(incrementFor('Barbell')).toBe(2.5)
    expect(incrementFor('Machine')).toBe(2.5)
    expect(incrementFor('Dumbbell')).toBe(2)
    expect(incrementFor('Body Only')).toBe(0)
    expect(incrementFor(undefined)).toBe(2.5)
    // libellés français du catalogue
    expect(incrementFor('Barre')).toBe(2.5)
    expect(incrementFor('Haltères')).toBe(2)
    expect(incrementFor('Kettlebell')).toBe(2)
    expect(incrementFor('Poids du corps')).toBe(0)
    expect(incrementFor('Poulie')).toBe(2.5)
  })
})

describe('double progression', () => {
  const opts = { targetReps: '8-10', equipment: 'Barbell' }

  it('sans historique : aucune suggestion', () => expect(suggestNextLoad([], opts)).toBeNull())

  it('toutes les séries au haut de la fourchette : +2,5 kg, retour à 8 reps', () => {
    const s = suggestNextLoad([session([[60, 10], [60, 10], [60, 10]])], opts)!
    expect(s.kind).toBe('increase')
    expect(s.weightKg).toBe(62.5)
    expect(s.reps).toBe(8)
  })

  it('haut de fourchette mais RPE 9,5 : on ne monte pas', () => {
    const s = suggestNextLoad([session([[60, 10, 9.5], [60, 10, 9.5]])], opts)!
    expect(s.kind).toBe('hold')
    expect(s.weightKg).toBe(60)
  })

  it('RPE 8,5 en haut de fourchette : on monte quand même', () => {
    expect(suggestNextLoad([session([[60, 10, 8.5], [60, 10, 8.5]])], opts)!.kind).toBe('increase')
  })

  it('dans la fourchette : même charge, +1 rep sur la série la plus faible', () => {
    const s = suggestNextLoad([session([[60, 9], [60, 8], [60, 8]])], opts)!
    expect(s.kind).toBe('add-rep')
    expect(s.weightKg).toBe(60)
    expect(s.reps).toBe(9)
  })

  it('sous le bas de la fourchette : on garde la charge et on vise le bas', () => {
    const s = suggestNextLoad([session([[60, 6], [60, 6]])], opts)!
    expect(s.kind).toBe('hold')
    expect(s.reps).toBe(8)
  })

  it('deux séances de suite sous le bas : décharge de ~10 %', () => {
    const s = suggestNextLoad([session([[60, 6], [60, 5]], 2), session([[60, 7], [60, 6]], 1)], opts)!
    expect(s.kind).toBe('deload')
    expect(s.weightKg).toBe(55) // 60 × 0,9 = 54 → arrondi à 55
  })

  it('un seul échec ne déclenche pas la décharge', () => {
    const s = suggestNextLoad([session([[60, 6], [60, 5]], 2), session([[60, 10], [60, 10]], 1)], opts)!
    expect(s.kind).not.toBe('deload')
  })

  it('poids du corps : on ajoute des reps au lieu de la charge', () => {
    const s = suggestNextLoad([session([[0, 10], [0, 10]])], { targetReps: '8-10', equipment: 'Body Only' })!
    expect(s.kind).toBe('add-rep')
    expect(s.weightKg).toBe(0)
    expect(s.reps).toBe(11)
  })

  it('haltères : +2 kg', () => {
    const s = suggestNextLoad([session([[20, 12], [20, 12]])], { targetReps: '10-12', equipment: 'Dumbbell' })!
    expect(s.weightKg).toBe(22)
  })

  it('ne suggère une hausse qu’avec au moins 2 séries à la charge la plus lourde', () => {
    expect(suggestNextLoad([session([[60, 10]])], opts)!.kind).toBe('add-rep')
  })
})
