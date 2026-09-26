import { getDb } from './db'
import { pushRecord } from './cloudSync'
import type { DailyFatigue } from '../types'

export const FATIGUE_LABEL: Record<number, string> = { 1: 'Frais', 2: 'Léger', 3: 'Moyen', 4: 'Fatigué', 5: 'Épuisé' }

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)))

export async function getFatigue(date: string): Promise<DailyFatigue | null> {
  return (await (await getDb()).get('fatigue', date)) ?? null
}

/** Enregistre un ou deux curseurs pour le jour ; l'autre valeur est conservée (3 = « moyen » par défaut). */
export async function saveFatigue(date: string, patch: Partial<Pick<DailyFatigue, 'general' | 'muscular'>>): Promise<DailyFatigue> {
  const existing = await getFatigue(date)
  const next: DailyFatigue = {
    id: date,
    date,
    general: clamp(patch.general ?? existing?.general ?? 3),
    muscular: clamp(patch.muscular ?? existing?.muscular ?? 3),
    updatedAt: Date.now(),
  }
  await (await getDb()).put('fatigue', next)
  pushRecord('fatigue', next.id, next)
  return next
}

/** Fatigue élevée (4-5 sur l'un des deux curseurs) : on conseille d'alléger. */
export function isHighFatigue(f: Pick<DailyFatigue, 'general' | 'muscular'> | null): boolean {
  return f != null && (f.general >= 4 || f.muscular >= 4)
}
