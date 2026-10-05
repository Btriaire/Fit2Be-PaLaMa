import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROFILE } from '../test/fixtures'

const pushRecord = vi.fn()
let gfSleep: number | null = null
vi.mock('./cloudSync', () => ({ pushRecord: (...a: unknown[]) => pushRecord(...a), deleteRecord: () => {} }))
vi.mock('./googleFit', () => ({ getGoogleFitForDate: async () => (gfSleep == null ? null : { sleepMinutes: gfSleep }) }))
vi.mock('./recovery', () => ({ computeDailyRecovery: async () => ({ bodyBatteryPenalty: 10 }) }))

import { getDb } from './db'
import { computeSubjectiveScore, isHighFatigueCheckin, loadCheckinDraft, saveCheckin } from './checkin'

const DAY = '2026-10-05'

beforeEach(async () => {
  const db = await getDb()
  await Promise.all([db.clear('recovery'), db.clear('fatigue')])
  pushRecord.mockClear()
  gfSleep = null
})

describe('check-in du jour', () => {
  it('pré-remplit le sommeil depuis Google Fit (arrondi au quart d’heure)', async () => {
    gfSleep = 445
    const { draft, saved } = await loadCheckinDraft(DAY)
    expect(saved).toBeNull()
    expect(draft.sleepHours).toBe(7.5)
    expect(draft.sleepSource).toBe('googlefit')
  })

  it('reprend les anciens curseurs de fatigue de l’Accueil (1-5 → 1-10)', async () => {
    await (await getDb()).put('fatigue', { id: DAY, date: DAY, general: 4, muscular: 2, updatedAt: 0 })
    const { draft } = await loadCheckinDraft(DAY)
    expect(draft.generalFatigue).toBe(8)
    expect(draft.muscleFatigue).toBe(4)
  })

  it('un seul enregistrement par jour, Body Battery = ressenti − charge du jour', async () => {
    const draft = { sleepHours: 8, sleepSource: 'manual' as const, generalFatigue: 1, muscleFatigue: 1, motivation: 5 }
    await saveCheckin(DAY, draft, PROFILE)
    const second = await saveCheckin(DAY, { ...draft, motivation: 4 }, PROFILE)
    const rows = await (await getDb()).getAllFromIndex('recovery', 'byDate', DAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].motivation).toBe(4)
    expect(second.bodyBatteryScore).toBe(computeSubjectiveScore({ ...draft, motivation: 4 }, PROFILE.sleepTargetMin) - 10)
    const reloaded = await loadCheckinDraft(DAY)
    expect(reloaded.saved?.id).toBe(second.id)
    expect(reloaded.draft.sleepSource).toBe('manual')
  })

  it('score : forme parfaite = 100, tout au plus mal = bas', () => {
    expect(computeSubjectiveScore({ sleepHours: 8, generalFatigue: 1, muscleFatigue: 1, motivation: 5 }, 480)).toBe(100)
    expect(computeSubjectiveScore({ sleepHours: 3, generalFatigue: 10, muscleFatigue: 10, motivation: 1 }, 480)).toBeLessThanOrEqual(30)
  })

  it('fatigue élevée dès 7/10 sur l’une des deux', () => {
    expect(isHighFatigueCheckin({ generalFatigue: 7, muscleFatigue: 2 })).toBe(true)
    expect(isHighFatigueCheckin({ generalFatigue: 3, muscleFatigue: 8 })).toBe(true)
    expect(isHighFatigueCheckin({ generalFatigue: 6, muscleFatigue: 6 })).toBe(false)
    expect(isHighFatigueCheckin(null)).toBe(false)
  })
})
