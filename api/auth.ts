// Une seule route (le plan Vercel gratuit limite à 12 fonctions) :
//   GET    -> { required, authenticated } : l'app décide d'afficher l'écran de connexion
//   POST   -> { password } : pose le cookie de session si le mot de passe est bon
//   DELETE -> déconnexion (efface le cookie)
import { authRequired, clearedCookie, isAuthenticated, makeToken, passwordMatches, sessionCookie } from './_auth.js'

interface VercelRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearedCookie())
    res.status(200).json({ ok: true })
    return
  }

  if (req.method === 'POST') {
    if (!authRequired()) {
      res.status(200).json({ ok: true, required: false })
      return
    }
    const body = req.body as { password?: unknown } | undefined
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!passwordMatches(password)) {
      // Ralentit les essais en rafale (chaque essai coûte ~0,8 s).
      await sleep(800)
      res.status(401).json({ ok: false, error: 'Mot de passe incorrect' })
      return
    }
    res.setHeader('Set-Cookie', sessionCookie(makeToken()))
    res.status(200).json({ ok: true })
    return
  }

  res.status(200).json({ required: authRequired(), authenticated: !authRequired() || isAuthenticated(req) })
}
