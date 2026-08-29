// Client pour /api/motivation (texte Groq + synthèse Piper) et /api/announce
// (synthèse directe, sans Groq, pour un texte déjà connu — ex: le libellé
// d'une phase de programme cardio). Best-effort comme le reste de l'IA : un
// échec réseau ne doit jamais interrompre l'entraînement, juste rester
// silencieux.

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
 * un empilement de requêtes si plusieurs séries/changements de phase
 * arrivent coup sur coup. Partagé entre motivation et annonces de phase :
 * elles ne doivent jamais se chevaucher. */
let inFlight = false

async function fetchAndPlay(url: string, body: unknown): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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

export function playMotivation(voice: MotivationVoiceId, context: MotivationContext): Promise<void> {
  return fetchAndPlay('/api/motivation', { voice, context })
}

/** Annonce un texte court tel quel (ex: le libellé d'une phase — "Effort",
 * "Récupération") — pas de génération Groq, juste la synthèse vocale. */
export function playAnnouncement(voice: MotivationVoiceId, text: string): Promise<void> {
  return fetchAndPlay('/api/announce', { voice, text })
}
