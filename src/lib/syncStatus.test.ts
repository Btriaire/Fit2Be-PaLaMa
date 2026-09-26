import { beforeEach, describe, expect, it, vi } from 'vitest'

async function fresh() {
  vi.resetModules()
  return import('./syncStatus')
}

beforeEach(() => localStorage.clear())

describe('état de sauvegarde', () => {
  it('démarre neutre', async () => {
    const m = await fresh()
    expect(m.getSyncStatus()).toEqual({ lastOkAt: null, consecutiveFails: 0 })
  })

  it('compte les échecs consécutifs et les remet à zéro au premier succès', async () => {
    const m = await fresh()
    m.recordSyncResult(false)
    m.recordSyncResult(false)
    expect(m.getSyncStatus().consecutiveFails).toBe(2)
    m.recordSyncResult(true)
    expect(m.getSyncStatus().consecutiveFails).toBe(0)
    expect(m.getSyncStatus().lastOkAt).not.toBeNull()
  })

  it('persiste entre deux chargements', async () => {
    const a = await fresh()
    a.recordSyncResult(true)
    const at = a.getSyncStatus().lastOkAt
    const b = await fresh()
    expect(b.getSyncStatus().lastOkAt).toBe(at)
  })

  it('n’alerte qu’après 3 échecs de suite', async () => {
    const m = await fresh()
    expect(m.isSyncDegraded({ lastOkAt: Date.now(), consecutiveFails: 2 })).toBe(false)
    expect(m.isSyncDegraded({ lastOkAt: Date.now(), consecutiveFails: 3 })).toBe(true)
  })

  it('alerte si aucun succès depuis plus de 24 h et au moins un échec', async () => {
    const m = await fresh()
    const old = Date.now() - 25 * 3600_000
    expect(m.isSyncDegraded({ lastOkAt: old, consecutiveFails: 1 })).toBe(true)
    expect(m.isSyncDegraded({ lastOkAt: old, consecutiveFails: 0 })).toBe(false)
  })

  it('notifie les abonnés', async () => {
    const m = await fresh()
    const fn = vi.fn()
    const off = m.subscribeSyncStatus(fn)
    m.recordSyncResult(false)
    expect(fn).toHaveBeenCalledTimes(1)
    off()
    m.recordSyncResult(false)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
