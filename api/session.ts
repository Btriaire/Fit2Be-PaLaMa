// GET  -> { required, authenticated } : l'app décide d'afficher l'écran de connexion.
// DELETE -> déconnexion (efface le cookie).
import { authRequired, clearedCookie, isAuthenticated } from './_auth.js'

interface VercelRequest {
  method?: string
  headers?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearedCookie())
    res.status(200).json({ ok: true })
    return
  }
  res.status(200).json({ required: authRequired(), authenticated: !authRequired() || isAuthenticated(req) })
}
