// Authentification mono-utilisateur : un mot de passe (APP_PASSWORD, variable d'environnement
// Vercel) échangé contre un cookie signé HttpOnly. Tant qu'APP_PASSWORD n'est pas défini,
// l'API reste ouverte (mode de transition : on ne s'enferme pas dehors avant d'avoir posé
// le mot de passe) — /api/session indique alors `required: false`.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const COOKIE_NAME = 'f2b_session'
export const SESSION_MAX_AGE_S = 60 * 24 * 3600

type Headers = Record<string, string | string[] | undefined>

interface AuthReq {
  headers?: Headers
}
interface AuthRes {
  status(code: number): AuthRes
  json(body: unknown): void
}

export function authRequired(): boolean {
  return !!process.env.APP_PASSWORD
}

/** Clé de signature : SESSION_SECRET si défini, sinon dérivée du mot de passe (changer le mot de passe invalide les sessions). */
function signingKey(): string {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || ''
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url')
}

export function makeToken(key = signingKey(), now = Date.now()): string {
  const exp = String(now + SESSION_MAX_AGE_S * 1000)
  return `${exp}.${sign(exp, key)}`
}

export function verifyToken(token: string | undefined, key = signingKey(), now = Date.now()): boolean {
  if (!token || !key) return false
  const dot = token.indexOf('.')
  if (dot < 1) return false
  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(exp, key)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const expMs = Number(exp)
  return Number.isFinite(expMs) && expMs > now
}

export function readCookie(header: string | string[] | undefined, name: string): string | undefined {
  const raw = Array.isArray(header) ? header.join(';') : header
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return undefined
}

export function isAuthenticated(req: AuthReq): boolean {
  return verifyToken(readCookie(req.headers?.cookie, COOKIE_NAME))
}

/** Renvoie true si la requête peut continuer ; sinon répond 401 et renvoie false. */
export function requireAuth(req: AuthReq, res: AuthRes): boolean {
  if (!authRequired() || isAuthenticated(req)) return true
  res.status(401).json({ error: 'unauthorized' })
  return false
}

/** Comparaison à temps constant (via hachage, pour ne pas dépendre de la longueur). */
export function passwordMatches(input: string, expected = process.env.APP_PASSWORD ?? ''): boolean {
  if (!expected) return false
  const a = createHash('sha256').update(input).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_S}`
}

export function clearedCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}
