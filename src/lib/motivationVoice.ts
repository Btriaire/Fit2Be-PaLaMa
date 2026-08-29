// Client pour /api/motivation — voix de motivation générées à la volée
// (texte Groq + synthèse Piper sur le VPS) après chaque série/pendant une
// séance cardio. Best-effort comme le reste de l'IA : un échec réseau ne
// doit jamais interrompre l'entraînement, juste rester silencieux.

export type MotivationVoiceId = 'coach' | 'calme'

interface SetContext {
  kind: 'set'
  exercise: string
  weightKg: number
  reps: number
  isPr?: boolean
}

interface CardioContext {
  kind: 'cardio'
  activityType: string
  elapsedMin: number
  distanceKm?: number
}

export type MotivationContext = SetContext | CardioContext

let playing: HTMLAudioElement | null = null

/** Ignore l'appel si un clip est déjà en cours de chargement/lecture — évite
 * un empilement de requêtes si plusieurs séries sont validées coup sur coup. */
let inFlight = false

export async function playMotivation(voice: MotivationVoiceId, context: MotivationContext): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    const r = await fetch('/api/motivation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voice, context }),
    })
    if (!r.ok) return
    const data = await r.json()
    if (!data.ok || !data.audioBase64) return

    playing?.pause()
    const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`)
    playing = audio
    await audio.play().catch(() => {
      // Lecture bloquée (politique autoplay) — best-effort, on abandonne silencieusement.
    })
  } catch {
    // réseau indisponible — best-effort
  } finally {
    inFlight = false
  }
}
