// Vercel serverless function — analyse IA (progression / récupération / diet)
// via Groq, même moteur que blood-doctor et nutri-tracker (GROQ_API_KEY
// reste côté serveur, jamais dans le bundle client). Le prompt système change
// selon `type`, le corps de la requête est le contexte brut (JSON) que le
// client a déjà assemblé localement — aucune donnée n'est relue depuis une
// base ici, cette fonction ne fait que transmettre à Groq et renvoyer du JSON.

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-120b'

const SYSTEM_PROMPTS: Record<string, string> = {
  progression: `Tu es un coach sportif qui analyse la PROGRESSION d'un utilisateur à partir de l'historique fourni (séances gym, activités, endurance, poids, calories). Ce n'est pas un avis médical.

Règles :
- Base-toi uniquement sur les données fournies, n'invente aucune valeur.
- Mets en avant les tendances (charges, volume, régularité, calories) plutôt que des chiffres isolés.
- Reste factuel, concis, en français, ton encourageant.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans texte autour :
{
  "summary": string,
  "strengths": [string],
  "attentionPoints": [string],
  "suggestions": [string]
}`,
  recovery: `Tu es un coach qui analyse la RÉCUPÉRATION d'un utilisateur (sommeil, fatigue musculaire, stress, Body Battery, charge d'entraînement récente). Ce n'est pas un avis médical.

Règles :
- Base-toi uniquement sur les données fournies.
- Identifie les signes de sous-récupération (surcharge, sommeil insuffisant, fatigue qui monte) ou au contraire une bonne marge pour pousser plus.
- Reste factuel, concis, en français, ton bienveillant, jamais alarmiste.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans texte autour :
{
  "summary": string,
  "riskLevel": "faible" | "modéré" | "élevé",
  "signals": [string],
  "suggestions": [string]
}`,
  diet: `Tu es un coach nutrition qui propose des AJUSTEMENTS d'aliments/macros à partir de l'entraînement récent, de la récupération et de l'historique alimentaire d'un utilisateur, en respectant STRICTEMENT son objectif calorique quotidien fourni. Ce n'est pas un avis médical.

Règles :
- Ne propose jamais de dépasser l'objectif calorique donné — ajuste la répartition, pas le total, sauf si l'utilisateur est objectivement sous son minimum vital.
- Relie les suggestions à des faits concrets (ex: gros volume musculation hier + faible protéine aujourd'hui -> augmenter les protéines).
- Reste factuel, concis, en français.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans texte autour :
{
  "summary": string,
  "increase": [{"item": string, "reason": string}],
  "decrease": [{"item": string, "reason": string}],
  "calorieTargetRespected": true
}`,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    res.status(200).json({ ok: false, skipped: true, reason: 'AI not configured' })
    return
  }

  const body = (req.body ?? {}) as { type?: string; context?: unknown }
  const systemPrompt = body.type ? SYSTEM_PROMPTS[body.type] : undefined
  if (!systemPrompt) {
    res.status(400).json({ error: 'Invalid or missing type' })
    return
  }

  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(body.context ?? {}) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      }),
    })
    if (!r.ok) {
      res.status(200).json({ ok: false, skipped: true, reason: `groq ${r.status}` })
      return
    }
    const data = await r.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      res.status(200).json({ ok: false, skipped: true, reason: 'empty response' })
      return
    }
    res.status(200).json({ ok: true, result: JSON.parse(content) })
  } catch {
    res.status(200).json({ ok: false, skipped: true, reason: 'network error' })
  }
}
