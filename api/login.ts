// POST { password } -> pose le cookie de session si le mot de passe est bon.
import { authRequired, makeToken, passwordMatches, sessionCookie } from './_auth.js'

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!authRequired()) {
    res.status(200).json({ ok: true, required: false })
    return
  }
  const password = typeof (req.body as { password?: unknown } | undefined)?.password === 'string' ? (req.body as { password: string }).password : ''
  if (!passwordMatches(password)) {
    // Ralentit les essais en rafale (chaque essai coûte ~0,8 s).
    await sleep(800)
    res.status(401).json({ ok: false, error: 'Mot de passe incorrect' })
    return
  }
  res.setHeader('Set-Cookie', sessionCookie(makeToken()))
  res.status(200).json({ ok: true })
}
