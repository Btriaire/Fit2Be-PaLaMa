import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROFILE } from '../test/fixtures'

vi.mock('./cloudSync', () => ({ pushRecord: () => {}, deleteRecord: () => {} }))

import { getDb } from './db'
import { allocateWalk, computeAllocation, currentShares, deleteActivityLog, evenShares, needsCategorizing } from './walkAllocation'
import type { EnduranceSession } from '../types'

const noon = new Date('2026-10-05T12:00:00').getTime()
const walk = (over: Partial<EnduranceSession> = {}): EnduranceSession => ({
  id: 'w1',
  activityType: 'marche',
  startedAt: noon,
  durationMin: 60,
  caloriesBurned: 240,
  externalId: 'healthkit-w1',
  ...over,
})

beforeEach(async () => {
  const db = await getDb()
  await Promise.all([db.clear('endurance'), db.clear('activities')])
})

describe('répartition d’une marche', () => {
  it('pourcentages → minutes, la journée normale prend le reste', () => {
    expect(computeAllocation(60, { shopping: 50, jardinage: 50 })).toEqual({ minutesById: { shopping: 30, jardinage: 30 }, normalMin: 0 })
    expect(computeAllocation(60, { shopping: 25 })).toEqual({ minutesById: { shopping: 15 }, normalMin: 45 })
    expect(computeAllocation(10, { shopping: 34, jardinage: 33, menage: 33 }).normalMin).toBeGreaterThanOrEqual(0)
  })

  it('répartit équitablement les catégories choisies', () => {
    expect(evenShares(['a', 'b'])).toEqual({ a: 50, b: 50 })
    expect(Object.values(evenShares(['a', 'b', 'c'])).reduce((s, n) => s + n, 0)).toBe(100)
  })

  it('50 % courses / 50 % jardinage sur une marche importée : 2 activités, marche vidée, rien compté deux fois', async () => {
    const db = await getDb()
    await db.put('endurance', walk())
    await allocateWalk('w1', { shopping: 50, jardinage: 50 }, PROFILE)
    const logs = await db.getAll('activities')
    expect(logs.map((l) => [l.label, l.durationMin, l.fromWalkId]).sort()).toEqual([
      ['Courses (magasins)', 30, 'w1'],
      ['Jardinage', 30, 'w1'],
    ])
    const w = await db.get('endurance', 'w1')
    expect(w?.durationMin).toBe(0)
    expect(w?.caloriesBurned).toBe(0)
    expect(w?.walkCategorized).toBe(true)
  })

  it('recatégoriser remplace la répartition précédente (repart de la marche d’origine)', async () => {
    const db = await getDb()
    await db.put('endurance', walk())
    await allocateWalk('w1', { shopping: 50 }, PROFILE)
    await allocateWalk('w1', { jardinage: 25 }, PROFILE)
    const logs = await db.getAll('activities')
    expect(logs.map((l) => [l.label, l.durationMin])).toEqual([['Jardinage', 15]])
    const w = await db.get('endurance', 'w1')
    expect(w?.durationMin).toBe(45)
    expect(w?.caloriesBurned).toBe(180) // 240 × 45/60
    expect(currentShares(w!, logs)).toEqual({ jardinage: 25 })
  })

  it('supprimer une part rend minutes et calories à la marche', async () => {
    const db = await getDb()
    await db.put('endurance', walk())
    await allocateWalk('w1', { shopping: 50, jardinage: 50 }, PROFILE)
    const shopping = (await db.getAll('activities')).find((l) => l.label === 'Courses (magasins)')!
    await deleteActivityLog(shopping.id)
    const w = await db.get('endurance', 'w1')
    expect(w?.durationMin).toBe(30)
    expect(w?.caloriesBurned).toBe(120)
    expect(w?.walkCategorized).toBe(true) // il reste la part jardinage
  })

  it('100 % journée normale = marche confirmée, plus proposée', async () => {
    const db = await getDb()
    await db.put('endurance', walk())
    expect(needsCategorizing(walk(), [])).toBe(true)
    await allocateWalk('w1', {}, PROFILE)
    const w = await db.get('endurance', 'w1')
    expect(w?.durationMin).toBe(60)
    expect(needsCategorizing(w!, [])).toBe(false)
  })

  it('ne propose pas les sorties marche saisies à la main ni les autres sports', () => {
    expect(needsCategorizing(walk({ externalId: undefined }), [])).toBe(false)
    expect(needsCategorizing(walk({ activityType: 'course' }), [])).toBe(false)
    expect(needsCategorizing(walk({ id: 'steps-2026-10-05', externalId: 'steps-2026-10-05' }), [])).toBe(true)
  })
})
