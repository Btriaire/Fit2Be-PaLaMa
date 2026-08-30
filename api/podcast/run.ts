// Vercel serverless function — proxy vers le manager VPS pour lancer une
// génération de podcast de progression à la demande (même service que celui
// qui tourne déjà en cron hebdomadaire, voir /opt/notebooklm-fit2be sur le
// VPS). Même pattern que api/nutritracker.ts / api/cloudsync.ts.

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const VPS_MANAGER_URL = process.env.VPS_MANAGER_URL || 'http://46.202.131.240:9000'
const VALID_PERIODS = new Set(['7d', '30d', '90d', 'all'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const body = (req.body ?? {}) as { period?: string }
  const period = VALID_PERIODS.has(body.period ?? '') ? body.period : '7d'

  try {
    const r = await fetch(`${VPS_MANAGER_URL}/api/notebooklm-fit2be/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ period }),
    })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch {
    res.status(502).json({ success: false, error: 'VPS injoignable' })
  }
}
