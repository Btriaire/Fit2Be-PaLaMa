// Vercel serverless function — OCR/extraction d'une capture d'écran de détail
// fréquence cardiaque Apple Health ou Google Fit/Health Connect via un
// modèle vision Groq. Même pattern que parse-machine-result.ts : ces apps ont
// un vrai capteur FC continu (montre connectée) que Fit2Be-PaLaMa n'a pas,
// donc bien plus précis qu'une estimation MET/formule.

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: unknown): void
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

interface ParsedHealthScreen {
  avgBpm: number | null
  zoneBreakdown: Array<{ zone: number; bpmMin: number; bpmMax: number | null; minutes: number }>
  recoveryPoints: Array<{ minutesAfter: number; bpm: number }>
}

const PROMPT = `Tu analyses une capture d'écran de détail de fréquence cardiaque venant d'Apple Health ou de Google Fit/Health Connect (page "Fréquence cardiaque" d'une séance de sport).
Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte autour.

Format exact :
{"avgBpm":123,"zoneBreakdown":[{"zone":1,"bpmMin":0,"bpmMax":120,"minutes":17.6},{"zone":2,"bpmMin":121,"bpmMax":130,"minutes":8.5},{"zone":3,"bpmMin":131,"bpmMax":140,"minutes":9.65},{"zone":4,"bpmMin":141,"bpmMax":150,"minutes":6.05},{"zone":5,"bpmMin":151,"bpmMax":null,"minutes":0.15}],"recoveryPoints":[{"minutesAfter":0,"bpm":114},{"minutesAfter":1,"bpm":104},{"minutesAfter":2,"bpm":99}]}

Règles :
- avgBpm = "Fréq. cardiaque moy." (ou équivalent). null si absent.
- zoneBreakdown = les lignes "Zone 1" à "Zone 5" avec leur plage BPM et leur durée. Convertis "MM:SS" en minutes décimales (ex "17:37" -> 17.62). bpmMax=null pour la zone la plus haute si elle affiche "&gt;X" sans borne haute. Tableau vide [] si cette section n'est pas visible.
- recoveryPoints = la section "Fréquence cardiaque après exercice" (ou "Heart Rate Recovery") si présente — chaque point labellisé (heure de fin = minutesAfter 0, "1 MIN" = 1, "2 MIN" = 2, etc.) avec sa valeur BPM. Tableau vide [] si absent.
- N'invente aucune valeur non visible à l'écran.`

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
        max_tokens: 768,
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
    const parsed = JSON.parse(jsonStr) as ParsedHealthScreen

    res.status(200).json({
      avgBpm: parsed.avgBpm ?? null,
      zoneBreakdown: Array.isArray(parsed.zoneBreakdown) ? parsed.zoneBreakdown : [],
      recoveryPoints: Array.isArray(parsed.recoveryPoints) ? parsed.recoveryPoints : [],
    })
  } catch (err) {
    console.error('parse-health-screen error:', err)
    const msg = err instanceof Error ? err.message : 'erreur inconnue'
    res.status(500).json({ error: `Reconnaissance échouée: ${msg}` })
  }
}
