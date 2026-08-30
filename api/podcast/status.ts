// Vercel serverless function — statut de la génération (en cours ? fichiers
// prêts ?) côté manager VPS. Voir api/podcast/run.ts pour le contexte.

interface VercelRequest {
  method?: string
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const VPS_MANAGER_URL = process.env.VPS_MANAGER_URL || 'http://46.202.131.240:9000'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch(`${VPS_MANAGER_URL}/api/notebooklm-fit2be/status`, { cache: 'no-store' })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch {
    res.status(502).json({ success: false, error: 'VPS injoignable' })
  }
}
