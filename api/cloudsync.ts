// Vercel serverless function — proxies durable-storage sync to the small
// self-hosted server on the VPS. The shared secret lives only in this
// server-side env var, never in the client bundle, same pattern as
// api/nutritracker.ts.

interface VercelRequest {
  method?: string
  body?: unknown
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env.CLOUDSYNC_BASE_URL
  const secret = process.env.CLOUDSYNC_SECRET
  if (!baseUrl || !secret) {
    res.status(200).json({ ok: false, skipped: true, reason: 'sync not configured' })
    return
  }

  try {
    if (req.method === 'GET') {
      const qs = new URLSearchParams()
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') qs.set(key, value)
      }
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      const r = await fetch(`${baseUrl}/api/sync${suffix}`, {
        headers: { 'x-sync-secret': secret },
      })
      const data = await r.json()
      res.status(r.status).json(data)
      return
    }

    if (req.method === 'POST') {
      const r = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sync-secret': secret },
        body: JSON.stringify(req.body ?? {}),
      })
      const data = await r.json()
      res.status(r.status).json(data)
      return
    }

    if (req.method === 'DELETE') {
      const r = await fetch(`${baseUrl}/api/sync`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', 'x-sync-secret': secret },
        body: JSON.stringify(req.body ?? {}),
      })
      const data = await r.json()
      res.status(r.status).json(data)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    // Network failure reaching the VPS (offline, restart, etc.) — never let
    // a sync failure break the caller's local save.
    res.status(200).json({ ok: false, skipped: true, reason: 'network error' })
  }
}
