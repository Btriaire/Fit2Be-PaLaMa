import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushMissingToCloud, restoreFromCloudIfNeeded } from './cloudSync'

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
    expect(puts).toHaveLength(0)
  })

  it('ne se marque pas comme faite si le serveur répond « skipped »', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: false, skipped: true }))
    await restoreFromCloudIfNeeded(fakeDb().db)
  })

  it('restaure les enregistrements manquants, à chaque lancement connecté', async () => {
    vi.stubGlobal('fetch', respond(200, { workouts: [{ id: 'a', data: { id: 'a', name: 'Push' }, updatedAt: 1 }, { id: 'b', data: { id: 'b', name: 'Pull' }, updatedAt: 2 }] }))
    const { db, puts } = fakeDb({ workouts: [{ id: 'a' }] })
    await restoreFromCloudIfNeeded(db)
    expect(puts).toEqual([['workouts', { id: 'b', name: 'Pull' }]]) // 'a' existe déjà : jamais écrasé
  })

  it('rejoue la restauration même si elle a déjà tourné (drapeau retiré)', async () => {
    localStorage.setItem(FLAG, '1')
    const f = respond(200, {})
    vi.stubGlobal('fetch', f)
    await restoreFromCloudIfNeeded(fakeDb().db)
    expect(f).toHaveBeenCalled()
  })
})

describe('renvoi des enregistrements manquants', () => {
  it('renvoie seulement les séances absentes du serveur', async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST' ? { ok: true } : { workouts: [{ id: 'a', data: {}, updatedAt: 1 }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', f)
    const { db } = fakeDb({ workouts: [{ id: 'a' }, { id: 'b' }] })
    const n = await pushMissingToCloud(db)
    expect(n).toBe(1)
    const posted = f.mock.calls.filter((c) => c[1]?.method === 'POST')
    expect(posted.length).toBe(1)
    expect(JSON.parse(posted[0][1]?.body as string).id).toBe('b')
  })

  it('ne fait rien hors ligne ou sans mot de passe', async () => {
    vi.stubGlobal('fetch', respond(401, {}))
    expect(await pushMissingToCloud(fakeDb({ workouts: [{ id: 'a' }] }).db)).toBe(0)
  })
})
