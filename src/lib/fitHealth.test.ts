import { describe, expect, it } from 'vitest'
import type { GoogleFitDay } from '../types'
import { assessFitHealth, effectiveSleepMinutes } from './fitHealth'

const NOW = new Date('2026-09-26T20:00:00Z').getTime()
const H = 3_600_000
const day = (date: string, sleepMinutes: number | null, hoursAgo: number | null = 1): GoogleFitDay => ({
  date,
  steps: 5000,
  activeCaloriesBurned: 0,
  activeMinutes: 0,
  heartRateAvg: null,
  sleepMinutes,
  syncedAt: NOW,
  remoteSyncedAt: hoursAgo == null ? null : NOW - hoursAgo * H,
})

describe('santé de la chaîne Google Fit', () => {
  it('rien à signaler quand tout est frais et que le sommeil remonte', () => {
    expect(assessFitHealth([day('2026-09-26', null), day('2026-09-25', 450), day('2026-09-24', 420)], NOW)).toEqual([])
  })

  it('signale des données périmées après 6 h', () => {
    const issues = assessFitHealth([day('2026-09-26', 400, 10), day('2026-09-25', 400, 30)], NOW)
    expect(issues.map((i) => i.id)).toContain('stale')
    expect(issues[0].text).toContain('10 h')
  })

  it('exprime les grandes pannes en jours', () => {
    expect(assessFitHealth([day('2026-09-26', 400, 72)], NOW)[0].text).toContain('3 j')
  })

  it('signale un sommeil absent depuis 2 jours ou plus, sans compter aujourd’hui', () => {
    const issues = assessFitHealth([day('2026-09-26', null), day('2026-09-25', null), day('2026-09-24', null), day('2026-09-23', null), day('2026-09-20', 508)], NOW)
    const sleep = issues.find((i) => i.id === 'no-sleep')!
    expect(sleep.text).toContain('3 jours')
  })

  it('un seul jour sans sommeil ne déclenche pas d’alerte', () => {
    expect(assessFitHealth([day('2026-09-26', null), day('2026-09-25', null), day('2026-09-24', 400)], NOW).some((i) => i.id === 'no-sleep')).toBe(false)
  })

  it('sans aucune donnée : le dit', () => {
    expect(assessFitHealth([], NOW)).toEqual([{ id: 'no-data', text: 'Aucune donnée Google Fit reçue pour le moment.' }])
  })
})

describe('sommeil effectif', () => {
  it('préfère la source synchronisée', () => expect(effectiveSleepMinutes({ sleepMinutes: 430 }, 6)).toBe(430))
  it('retombe sur les heures du check-in', () => expect(effectiveSleepMinutes({ sleepMinutes: null }, 7.5)).toBe(450))
  it('null sans aucune source', () => {
    expect(effectiveSleepMinutes(null, null)).toBeNull()
    expect(effectiveSleepMinutes({ sleepMinutes: null }, 0)).toBeNull()
  })
})
