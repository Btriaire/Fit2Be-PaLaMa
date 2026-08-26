// Vercel serverless function — OCR/extraction d'une photo d'écran de résultats
// de machine de cardio (Matrix, Technogym, etc.) via un modèle vision Groq.
// Même pattern que app/api/food/photo/route.ts dans nutri-tracker.

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

interface ParsedMachineResult {
  machineType: 'treadmill' | 'bike' | 'rower' | 'elliptical' | 'other'
  durationMin: number | null
  distanceKm: number | null
  calories: number | null
  avgHeartRate: number | null
  avgWatts: number | null
  avgSpeedKph: number | null
  avgMets: number | null
  peakHeartRate: number | null
  peakWatts: number | null
  peakSpeedKph: number | null
  elevationGainM: number | null
}

const PROMPT = `Tu analyses une photo d'écran de résultats d'une machine de cardio de salle de sport
(tapis de course, vélo, rameur, elliptique — marques comme Matrix, Technogym, Life Fitness...).
Extrait les valeurs de la colonne TOTAL (ou WORKOUT si pas de colonne total) et le type de machine.
Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte autour.

Format exact :
{"machineType":"treadmill|bike|rower|elliptical|other","durationMin":45,"distanceKm":4.07,"calories":265,"avgHeartRate":115,"avgWatts":83,"avgSpeedKph":5.4,"avgMets":4.9,"peakHeartRate":131,"peakWatts":110,"peakSpeedKph":5.8,"elevationGainM":117}

Convertis le temps total (ex "45:21") en minutes décimales arrondies à l'entier. Mets null pour toute valeur absente ou illisible.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'GROQ_API_KEY non configurée' })
    return
  }

  const body = req.body as { image?: string; mime?: string } | undefined
  if (!body?.image) {
    res.status(400).json({ error: 'No image' })
    return
  }
  const mime = body.mime || 'image/jpeg'

  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: 'json_object' },
        reasoning_effort: 'none',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mime};base64,${body.image}` } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      console.error('Groq vision error:', r.status, errText)
      res.status(502).json({ error: `Vision API error (${r.status})` })
      return
    }

    const data = (await r.json()) as { choices: { message: { content: string } }[] }
    const raw = data.choices?.[0]?.message?.content ?? '{}'
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const jsonStr = start !== -1 && end > start ? raw.slice(start, end + 1) : raw
    const parsed = JSON.parse(jsonStr) as ParsedMachineResult

    res.status(200).json(parsed)
  } catch (err) {
    console.error('parse-machine-result error:', err)
    const msg = err instanceof Error ? err.message : 'erreur inconnue'
    res.status(500).json({ error: `Reconnaissance échouée: ${msg}` })
  }
}
