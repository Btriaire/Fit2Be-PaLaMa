import { describe, expect, it } from 'vitest'
import { computeHrZone, computeMaxHr } from './heartRate'

describe('FC max et zones', () => {
  it('FC max = 220 − âge', () => expect(computeMaxHr(30)).toBe(190))

  it('zone selon le % de FC max (60/70/80/90)', () => {
    expect(computeHrZone(100, 30)).toBe(1)
    expect(computeHrZone(120, 30)).toBe(2)
    expect(computeHrZone(140, 30)).toBe(3)
    expect(computeHrZone(160, 30)).toBe(4)
    expect(computeHrZone(175, 30)).toBe(5)
  })
})
