// Vercel serverless function — génère une phrase de motivation courte (Groq,
// GROQ_API_KEY déjà utilisé par ai-insights.ts) puis la fait synthétiser en
// voix par le service TTS auto-hébergé sur le VPS (secret côté serveur,
// jamais dans le bundle client). Best-effort : ne doit jamais faire échouer
// une série ou une sortie si Groq/le VPS sont indisponibles.

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Même modèle que ai-insights.ts (seul confirmé dispo sur cette clé — un essai
// avec llama-3.3-70b-versatile a renvoyé 404 model_not_found). gpt-oss-120b est
// un modèle "raisonneur" : sans reasoning_effort bas, il dépense son budget de
// tokens en chain-of-thought caché et peut renvoyer un content vide sur une
// petite phrase avec un max_tokens serré.
const MODEL = 'openai/gpt-oss-120b'
const MOTIVATION_VPS_URL = process.env.MOTIVATION_VPS_URL || 'https://fit2be-motivation.46.202.131.240.nip.io'

type Voice = 'coach' | 'calme'

const VOICE_STYLE: Record<Voice, string> = {
  coach: 'un coach de musculation énergique, direct, qui pousse fort mais reste bienveillant — ton hype, phrases courtes et percutantes',
  calme: 'un motivateur calme et posé, façon coach mental — ton posé, encourage la concentration et la régularité plutôt que l\'euphorie',
}

const BASE_RULES = `Règles strictes :
- Réponds UNIQUEMENT avec la phrase de motivation, en français, rien d'autre (pas de guillemets, pas de markdown, pas d'emoji).
- Une seule phrase courte, maximum 15 mots — elle doit être dite à voix haute en 3-4 secondes.
- Base-toi sur les données fournies (exercice, poids, répétitions, record ou non) pour que ça sonne personnel, pas générique.
- Ne mentionne jamais que tu es une IA.`

function buildPrompt(voice: Voice, context: Record<string, unknown>): { system: string; user: string } {
  const style = VOICE_STYLE[voice]
  const system = `Tu es ${style}.\n${BASE_RULES}`

  if (context.kind === 'cardio') {
    const user = `Séance cardio en cours (${context.activityType ?? 'exercice'}), ${context.elapsedMin ?? '?'} minutes écoulées${
      context.distanceKm ? `, ${context.distanceKm} km parcourus` : ''
    }. Encourage-le/la à tenir le rythme.`
    return { system, user }
  }

  const user = `Série de musculation qui vient d'être terminée : ${context.exercise ?? 'exercice'}, ${context.weightKg ?? '?'}kg x ${
    context.reps ?? '?'
  } répétitions${context.isPr ? ' — nouveau record personnel !' : ''}. Félicite-le/la et pousse pour la suite.`
  return { system, user }
}

async function generateText(
  voice: Voice,
  context: Record<string, unknown>,
  apiKey: string,
): Promise<{ text: string | null; debug: string }> {
  const { system, user } = buildPrompt(voice, context)
  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.9,
      max_tokens: 200,
      reasoning_effort: 'low',
    }),
  })
  if (!r.ok) {
    const errBody = await r.text().catch(() => '')
    return { text: null, debug: `groq http ${r.status}: ${errBody.slice(0, 300)}` }
  }
  const data = await r.json()
  const content = data.choices?.[0]?.message?.content as string | undefined
  if (!content) return { text: null, debug: `groq empty content: ${JSON.stringify(data).slice(0, 300)}` }
  return { text: content.trim().replace(/^["«»]+|["«»]+$/g, ''), debug: 'ok' }
}

async function synthesize(text: string, voice: Voice, secret: string): Promise<{ audioBase64: string; mimeType: string } | null> {
  const r = await fetch(`${MOTIVATION_VPS_URL}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-motivation-secret': secret },
    body: JSON.stringify({ text, voice }),
  })
  if (!r.ok) return null
  const data = await r.json()
  if (!data.audioBase64) return null
  return { audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const groqKey = process.env.GROQ_API_KEY
  const vpsSecret = process.env.MOTIVATION_SECRET
  if (!groqKey || !vpsSecret) {
    res.status(200).json({ ok: false, skipped: true, reason: 'motivation not configured' })
    return
  }

  const body = (req.body ?? {}) as { voice?: Voice; context?: Record<string, unknown> }
  const voice: Voice = body.voice === 'calme' ? 'calme' : 'coach'
  const context = body.context ?? {}

  try {
    const { text, debug } = await generateText(voice, context, groqKey)
    if (!text) {
      res.status(200).json({ ok: false, skipped: true, reason: 'empty text', debug })
      return
    }
    const audio = await synthesize(text, voice, vpsSecret)
    if (!audio) {
      res.status(200).json({ ok: false, skipped: true, reason: 'tts failed', text })
      return
    }
    res.status(200).json({ ok: true, text, ...audio })
  } catch (err) {
    res.status(200).json({ ok: false, skipped: true, reason: 'network error', debug: err instanceof Error ? err.message : String(err) })
  }
}
