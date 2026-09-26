import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { authRequired, clearedCookie, isAuthenticated, makeToken, passwordMatches, readCookie, requireAuth, sessionCookie, verifyToken } from './_auth'

const KEY = 'clé-de-test'
const env = { ...process.env }

beforeEach(() => {
  delete process.env.APP_PASSWORD
  delete process.env.SESSION_SECRET
})
afterEach(() => {
  process.env = { ...env }
})

function fakeRes() {
  const res = { code: 0, body: undefined as unknown, status(c: number) { res.code = c; return res }, json(b: unknown) { res.body = b } }
  return res
}

describe('jeton de session', () => {
  it('un jeton frais est valide', () => expect(verifyToken(makeToken(KEY), KEY)).toBe(true))

  it('expire après 60 jours', () => {
    const now = Date.now()
    const token = makeToken(KEY, now)
    expect(verifyToken(token, KEY, now + 59 * 86_400_000)).toBe(true)
    expect(verifyToken(token, KEY, now + 61 * 86_400_000)).toBe(false)
  })

  it('refuse une autre clé', () => expect(verifyToken(makeToken(KEY), 'autre-clé')).toBe(false))

  it('refuse un jeton falsifié (échéance rallongée)', () => {
    const [exp, sig] = makeToken(KEY).split('.')
    expect(verifyToken(`${Number(exp) + 999_999_999}.${sig}`, KEY)).toBe(false)
  })

  it('refuse les jetons vides ou mal formés', () => {
    expect(verifyToken(undefined, KEY)).toBe(false)
    expect(verifyToken('', KEY)).toBe(false)
    expect(verifyToken('abc', KEY)).toBe(false)
    expect(verifyToken('.abc', KEY)).toBe(false)
    expect(verifyToken(makeToken(KEY), '')).toBe(false)
  })
})

describe('cookies', () => {
  it('lit le bon cookie parmi plusieurs', () => {
    expect(readCookie('a=1; f2b_session=xyz; b=2', 'f2b_session')).toBe('xyz')
    expect(readCookie('a=1', 'f2b_session')).toBeUndefined()
    expect(readCookie(undefined, 'f2b_session')).toBeUndefined()
  })
  it('le cookie de session est HttpOnly, Secure et SameSite', () => {
    const c = sessionCookie('tok')
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Max-Age=5184000')
    expect(clearedCookie()).toContain('Max-Age=0')
  })
})

describe('mot de passe', () => {
  it('compare sans dépendre de la longueur', () => {
    expect(passwordMatches('secret', 'secret')).toBe(true)
    expect(passwordMatches('secre', 'secret')).toBe(false)
    expect(passwordMatches('', 'secret')).toBe(false)
  })
  it('refuse tout quand aucun mot de passe n’est configuré', () => expect(passwordMatches('', '')).toBe(false))
})

describe('requireAuth', () => {
  it('reste ouvert tant qu’APP_PASSWORD n’est pas défini (transition)', () => {
    expect(authRequired()).toBe(false)
    const res = fakeRes()
    expect(requireAuth({ headers: {} }, res)).toBe(true)
    expect(res.code).toBe(0)
  })

  it('renvoie 401 sans cookie une fois le mot de passe défini', () => {
    process.env.APP_PASSWORD = 'secret'
    const res = fakeRes()
    expect(requireAuth({ headers: {} }, res)).toBe(false)
    expect(res.code).toBe(401)
  })

  it('laisse passer avec un cookie valide', () => {
    process.env.APP_PASSWORD = 'secret'
    const cookie = `f2b_session=${makeToken()}`
    expect(isAuthenticated({ headers: { cookie } })).toBe(true)
    expect(requireAuth({ headers: { cookie } }, fakeRes())).toBe(true)
  })

  it('refuse un cookie signé avec un ancien mot de passe', () => {
    process.env.APP_PASSWORD = 'ancien'
    const cookie = `f2b_session=${makeToken()}`
    process.env.APP_PASSWORD = 'nouveau'
    expect(isAuthenticated({ headers: { cookie } })).toBe(false)
  })

  it('SESSION_SECRET prime sur le mot de passe pour signer', () => {
    process.env.APP_PASSWORD = 'secret'
    process.env.SESSION_SECRET = 'autre'
    const cookie = `f2b_session=${makeToken()}`
    process.env.APP_PASSWORD = 'changé'
    expect(isAuthenticated({ headers: { cookie } })).toBe(true)
  })
})
