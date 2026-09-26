import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, dayKey, isSameDay, isToday, todayStr } from './date'

afterEach(() => vi.useRealTimers())

describe('date (heure locale Europe/Paris)', () => {
  it('dayKey utilise le jour LOCAL, pas UTC (00:30 à Paris = 22:30 UTC la veille)', () => {
    const ts = new Date('2026-06-15T22:30:00Z').getTime()
    expect(dayKey(ts)).toBe('2026-06-16')
    expect(new Date(ts).toISOString().slice(0, 10)).toBe('2026-06-15') // le piège qu'on évite
  })

  it('todayStr suit l’heure locale juste après minuit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T22:30:00Z'))
    expect(todayStr()).toBe('2026-06-16')
  })

  it('isToday / isSameDay comparent des jours locaux', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-10T23:30:00Z')) // 00:30 le 11 janvier à Paris (UTC+1)
    const at2310Utc = new Date('2026-01-10T23:10:00Z').getTime() // 00:10 le 11
    const at2200Utc = new Date('2026-01-10T22:00:00Z').getTime() // 23:00 le 10
    expect(isToday(at2310Utc)).toBe(true)
    expect(isToday(at2200Utc)).toBe(false)
    expect(isSameDay(at2310Utc, '2026-01-11')).toBe(true)
    expect(isSameDay(at2310Utc, '2026-01-10')).toBe(false)
    expect(isSameDay(at2200Utc, '2026-01-10')).toBe(true)
  })

  it('addDays traverse le changement d’heure sans sauter ni doubler un jour', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-10-26', -1)).toBe('2026-10-25')
  })

  it('addDays gère les fins de mois et d’année', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
