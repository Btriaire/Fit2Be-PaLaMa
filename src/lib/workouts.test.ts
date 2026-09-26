import { describe, expect, it } from 'vitest'
import { estimated1Rm } from './workouts'

describe('1RM estimé (Epley)', () => {
  it('une répétition = charge × 1,033', () => expect(estimated1Rm(100, 1)).toBe(103.3))
  it('100 kg × 8 est plus fort que 100 kg × 1', () => {
    expect(estimated1Rm(100, 8)).toBe(126.7)
    expect(estimated1Rm(100, 8)).toBeGreaterThan(estimated1Rm(100, 1))
  })
  it('poids nul = 0', () => expect(estimated1Rm(0, 10)).toBe(0))
})
