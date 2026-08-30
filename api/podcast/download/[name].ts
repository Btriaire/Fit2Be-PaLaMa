// Vercel serverless function — télécharge/streame un podcast .m4a déjà
// généré, depuis le manager VPS. ?inline=1 pour un <audio> lecteur direct
// (pas de Content-Disposition attachment) ; sinon téléchargement classique.

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(body: unknown): void
  send(body: unknown): void
}

const VPS_MANAGER_URL = process.env.VPS_MANAGER_URL || 'http://46.202.131.240:9000'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = typeof req.query.name === 'string' ? req.query.name : ''
  if (!/^[\w.-]+\.m4a$/.test(name)) {
    res.status(400).json({ error: 'Nom invalide' })
    return
  }

  const inline = req.query.inline === '1'
  const range = req.headers.range
  const rangeHeader = typeof range === 'string' ? range : undefined

  const r = await fetch(`${VPS_MANAGER_URL}/api/notebooklm-fit2be/download/${name}`, {
    headers: rangeHeader ? { Range: rangeHeader } : undefined,
  })
  if (!r.ok || !r.body) {
    res.status(404).json({ error: 'Fichier introuvable' })
    return
  }

  res.setHeader('Content-Type', 'audio/mp4')
  res.setHeader('Accept-Ranges', 'bytes')
  if (!inline) res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  const contentLength = r.headers.get('content-length')
  const contentRange = r.headers.get('content-range')
  if (contentLength) res.setHeader('Content-Length', contentLength)
  if (contentRange) res.setHeader('Content-Range', contentRange)

  const buf = Buffer.from(await r.arrayBuffer())
  res.status(r.status).send(buf)
}
