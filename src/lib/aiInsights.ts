// Client pour /api/ai-insights (analyse Groq) — même philosophie best-effort
// que le reste de la sync : jamais d'exception qui remonte à l'appelant,
// juste null en cas d'échec (offline, IA non configurée, etc).

export interface ProgressionInsight {
  summary: string
  strengths: string[]
  attentionPoints: string[]
  suggestions: string[]
}

export interface RecoveryInsight {
  summary: string
  riskLevel: 'faible' | 'modéré' | 'élevé'
  signals: string[]
  suggestions: string[]
}

export interface DietInsight {
  summary: string
  increase: { item: string; reason: string }[]
  decrease: { item: string; reason: string }[]
  calorieTargetRespected: boolean
}

async function callAi<T>(type: 'progression' | 'recovery' | 'diet', context: unknown): Promise<T | null> {
  try {
    const r = await fetch('/api/ai-insights', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, context }),
    })
    if (!r.ok) return null
    const data = await r.json()
    if (!data.ok) return null
    return data.result as T
  } catch {
    return null
  }
}

export function analyzeProgression(context: unknown) {
  return callAi<ProgressionInsight>('progression', context)
}

export function analyzeRecovery(context: unknown) {
  return callAi<RecoveryInsight>('recovery', context)
}

export function suggestDietAdjustments(context: unknown) {
  return callAi<DietInsight>('diet', context)
}
