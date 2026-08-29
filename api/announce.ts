// Vercel serverless function — annonce vocale courte (changement de phase
// pendant un programme cardio : "Effort", "Récupération"...) synthétisée
// directement par le VPS, SANS passer par Groq — contrairement à
// /api/motivation, le texte est déjà connu (le libellé de la phase), pas
// besoin de génération. Un programme fractionné peut changer de phase toutes
// les 30-90s ; ajouter un aller-retour LLM à chaque fois serait inutilement
// lent et coûteux pour un simple mot annoncé.

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const MOTIVATION_VPS_URL = process.env.MOTIVATION_VPS_URL || 'https://fit2be-motivation.46.202.131.240.nip.io'

type Voice = 'coach' | 'calme'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const secret = process.env.MOTIVATION_SECRET
  if (!secret) {
    res.status(200).json({ ok: false, skipped: true, reason: 'motivation not configured' })
    return
  }

  const body = (req.body ?? {}) as { text?: string; voice?: Voice }
  const text = (body.text ?? '').trim().slice(0, 60)
  const voice: Voice = body.voice === 'calme' ? 'calme' : 'coach'
  if (!text) {
    res.status(200).json({ ok: false, skipped: true, reason: 'empty text' })
    return
  }

  try {
    const r = await fetch(`${MOTIVATION_VPS_URL}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-motivation-secret': secret },
      body: JSON.stringify({ text, voice }),
    })
    if (!r.ok) {
      res.status(200).json({ ok: false, skipped: true, reason: `tts http ${r.status}` })
      return
    }
    const data = await r.json()
    if (!data.audioBase64) {
      res.status(200).json({ ok: false, skipped: true, reason: 'no audio' })
      return
    }
    res.status(200).json({ ok: true, audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' })
  } catch {
    res.status(200).json({ ok: false, skipped: true, reason: 'network error' })
  }
}
