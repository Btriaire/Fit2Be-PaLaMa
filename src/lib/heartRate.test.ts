import { describe, expect, it } from 'vitest'
import { computeHrZone, computeMaxHr, zoneBoundsBpm } from './heartRate'

describe('FC max (Tanaka)', () => {
  it('208 − 0,7 × âge', () => {
    expect(computeMaxHr(30)).toBe(187)
    expect(computeMaxHr(50)).toBe(173)
  })
  it('donne plus que 220 − âge après 40 ans', () => expect(computeMaxHr(60)).toBeGreaterThan(220 - 60))
})

describe('zones sans FC de repos (% FC max)', () => {
  it('seuils à 60 / 70 / 80 / 90 %', () => {
    expect(computeHrZone(100, 30)).toBe(1) // 53 %
    expect(computeHrZone(120, 30)).toBe(2) // 64 %
    expect(computeHrZone(140, 30)).toBe(3) // 75 %
    expect(computeHrZone(155, 30)).toBe(4) // 83 %
    expect(computeHrZone(175, 30)).toBe(5) // 94 %
  })
})

describe('zones avec FC de repos (Karvonen)', () => {
  // âge 30 → FC max 187, repos 60 → réserve 127
  it('utilise la FC de réserve', () => {
    expect(computeHrZone(120, 30, 60)).toBe(1) // 47 %
    expect(computeHrZone(135, 30, 60)).toBe(1) // 59 %
    expect(computeHrZone(137, 30, 60)).toBe(2) // 61 %
    expect(computeHrZone(160, 30, 60)).toBe(3) // 79 %, juste sous Z4
  })
  it('même FC, repos plus bas = zone plus haute', () => {
    expect(computeHrZone(150, 30, 45)).toBeGreaterThanOrEqual(computeHrZone(150, 30, 75))
  })
  it('ignore une FC de repos incohérente', () => {
    expect(computeHrZone(140, 30, 0)).toBe(computeHrZone(140, 30))
    expect(computeHrZone(140, 30, 250)).toBe(computeHrZone(140, 30))
  })
})

describe('fourchettes en bpm', () => {
  it('Z1 à Z5 contiguës, de 50 % de la réserve à la FC max', () => {
    const z = zoneBoundsBpm(30, 60)
    expect(z).toHaveLength(5)
    expect(z[0].minBpm).toBe(124) // 60 + 0,5 × 127 = 123,5
    expect(z[4].maxBpm).toBe(187)
    for (let i = 1; i < 5; i++) expect(z[i].minBpm).toBe(z[i - 1].maxBpm)
  })
  it('sans repos valide, calcule sur la FC max', () => {
    expect(zoneBoundsBpm(30, 0)[4].maxBpm).toBe(187)
    expect(zoneBoundsBpm(30, 0)[0].minBpm).toBe(94) // 50 % de 187 = 93,5
  })
})
