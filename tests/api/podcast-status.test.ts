import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/_auth.js', () => ({ requireAuth: vi.fn(() => true) }))

import handler from '../../api/podcast/status'
import { requireAuth } from '../../api/_auth.js'

function res() {
  const r = { code: 200, body: undefined as unknown }
  return {
    r,
    status(c: number) {
      r.code = c
      return this
    },
    json(b: unknown) {
      r.body = b
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(requireAuth).mockReturnValue(true)
})

describe('statut du podcast (api/podcast/status)', () => {
  it('relaie le statut du VPS tel quel', async () => {
    const payload = { success: true, running: false, files: [{ name: 'a.mp3', mtime: '2026-10-01', sizeKb: 1200 }] }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })))
    const out = res()
    await handler({ method: 'GET' }, out)
    expect(out.r.code).toBe(200)
    expect(out.r.body).toEqual(payload)
  })

  it('répond 502 quand le VPS est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const out = res()
    await handler({ method: 'GET' }, out)
    expect(out.r.code).toBe(502)
    expect(out.r.body).toMatchObject({ success: false })
  })

  it('n’appelle jamais le VPS sans session', async () => {
    vi.mocked(requireAuth).mockReturnValue(false)
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    await handler({ method: 'GET' }, res())
    expect(f).not.toHaveBeenCalled()
  })
})
