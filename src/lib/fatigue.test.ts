import { beforeEach, describe, expect, it, vi } from 'vitest'

const pushRecord = vi.fn()
vi.mock('./cloudSync', () => ({ pushRecord: (...a: unknown[]) => pushRecord(...a), deleteRecord: () => {} }))

import { getDb } from './db'
import { getFatigue, isHighFatigue, saveFatigue } from './fatigue'

beforeEach(async () => {
  await (await getDb()).clear('fatigue')
  pushRecord.mockClear()
})

describe('fatigue du jour', () => {
  it('rien d’enregistré = null', async () => expect(await getFatigue('2026-09-26')).toBeNull())

  it('enregistre un curseur, l’autre reste à « moyen »', async () => {
    const f = await saveFatigue('2026-09-26', { general: 4 })
    expect(f).toMatchObject({ id: '2026-09-26', date: '2026-09-26', general: 4, muscular: 3 })
    expect(await getFatigue('2026-09-26')).toMatchObject({ general: 4, muscular: 3 })
  })

  it('conserve l’autre valeur quand on modifie un seul curseur', async () => {
    await saveFatigue('2026-09-26', { general: 2, muscular: 5 })
    await saveFatigue('2026-09-26', { general: 4 })
    expect(await getFatigue('2026-09-26')).toMatchObject({ general: 4, muscular: 5 })
  })

  it('borne les valeurs entre 1 et 5', async () => {
    const f = await saveFatigue('2026-09-26', { general: 9, muscular: -2 })
    expect(f.general).toBe(5)
    expect(f.muscular).toBe(1)
  })

  it('un enregistrement par jour et synchronisation vers le VPS', async () => {
    await saveFatigue('2026-09-26', { general: 2 })
    await saveFatigue('2026-09-26', { muscular: 4 })
    expect((await (await getDb()).getAll('fatigue')).length).toBe(1)
    expect(pushRecord).toHaveBeenCalledTimes(2)
    expect(pushRecord).toHaveBeenLastCalledWith('fatigue', '2026-09-26', expect.objectContaining({ muscular: 4 }))
  })

  it('fatigue élevée dès 4 sur l’un des deux', () => {
    expect(isHighFatigue(null)).toBe(false)
    expect(isHighFatigue({ general: 3, muscular: 3 })).toBe(false)
    expect(isHighFatigue({ general: 4, muscular: 2 })).toBe(true)
    expect(isHighFatigue({ general: 2, muscular: 5 })).toBe(true)
  })
})
