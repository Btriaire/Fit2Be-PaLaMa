// Vercel serverless function — proxies weight/food sync to NutriTracker
// Palama's own API. The shared secret lives only in this server-side env
// var, never in the client bundle: the browser calls same-origin /api/
// nutritracker, this function calls out to nutri-tracker with the secret.

interface VercelRequest {
  method?: string
  body?: unknown
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const NUTRITRACKER_BASE_URL = process.env.NUTRITRACKER_BASE_URL || 'https://nutri-tracker-mocha.vercel.app'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.NUTRITRACKER_SYNC_SECRET
  if (!secret) {
    res.status(200).json({ ok: false, skipped: true, reason: 'sync not configured' })
    return
  }

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${NUTRITRACKER_BASE_URL}/api/vibefit`, {
        headers: { 'x-cron-secret': secret },
      })
      const data = await r.json()
      res.status(r.status).json(data)
      return
    }

    if (req.method === 'POST') {
      const r = await fetch(`${NUTRITRACKER_BASE_URL}/api/vibefit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-cron-secret': secret },
        body: JSON.stringify(req.body ?? {}),
      })
      const data = await r.json()
      res.status(r.status).json(data)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    // Network failure reaching nutri-tracker (offline, deploy hiccup, etc.) —
    // never let a sync failure break the caller's local save.
    res.status(200).json({ ok: false, skipped: true, reason: 'network error' })
  }
}
