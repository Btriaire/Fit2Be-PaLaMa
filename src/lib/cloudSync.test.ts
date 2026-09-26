import { afterEach, describe, expect, it, vi } from 'vitest'
import { restoreFromCloudIfNeeded } from './cloudSync'

const FLAG = 'fit2be:cloudRestoreDone'

function fakeDb(existing: Record<string, Array<{ id: string }>> = {}) {
  const puts: Array<[string, unknown]> = []
  return {
    puts,
    db: {
      getAll: async (store: string) => existing[store] ?? [],
      put: async (store: string, value: unknown) => {
        puts.push([store, value])
      },
    },
  }
}

const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

afterEach(() => vi.unstubAllGlobals())

describe('restauration depuis le VPS', () => {
  it('ne se marque PAS comme faite après un 401 (mot de passe non saisi)', async () => {
    vi.stubGlobal('fetch', respond(401, { error: 'unauthorized' }))
    const { db, puts } = fakeDb()
    await restoreFromCloudIfNeeded(db)
    expect(localStorage.getItem(FLAG)).toBeNull()
    expect(puts).toHaveLength(0)
  })

  it('ne se marque pas comme faite si le serveur répond « skipped »', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: false, skipped: true }))
    await restoreFromCloudIfNeeded(fakeDb().db)
    expect(localStorage.getItem(FLAG)).toBeNull()
  })

  it('restaure les enregistrements manquants et se marque comme faite', async () => {
    vi.stubGlobal('fetch', respond(200, { workouts: [{ id: 'a', data: { id: 'a', name: 'Push' }, updatedAt: 1 }, { id: 'b', data: { id: 'b', name: 'Pull' }, updatedAt: 2 }] }))
    const { db, puts } = fakeDb({ workouts: [{ id: 'a' }] })
    await restoreFromCloudIfNeeded(db)
    expect(puts).toEqual([['workouts', { id: 'b', name: 'Pull' }]]) // 'a' existe déjà : jamais écrasé
    expect(localStorage.getItem(FLAG)).not.toBeNull()
  })

  it('ne refait rien une fois le drapeau posé', async () => {
    localStorage.setItem(FLAG, '1')
    const f = respond(200, {})
    vi.stubGlobal('fetch', f)
    await restoreFromCloudIfNeeded(fakeDb().db)
    expect(f).not.toHaveBeenCalled()
  })
})
