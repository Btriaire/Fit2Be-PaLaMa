import type { HrZone } from '../types'

export const HR_ZONE_META: Record<HrZone, { label: string; color: string; range: string }> = {
  1: { label: 'Récupération', color: '#38bdf8', range: '50-60%' },
  2: { label: 'Zone 2 (endurance)', color: '#22c55e', range: '60-70%' },
  3: { label: 'Aérobie', color: '#facc15', range: '70-80%' },
  4: { label: 'Seuil', color: '#e2361c', range: '80-90%' },
  5: { label: 'Maximal', color: '#ef4444', range: '90-100%' },
}

export function computeMaxHr(ageYears: number) {
  return 220 - ageYears
}

/** Détermine la zone FC (1-5) à partir de la FC moyenne et de l'âge (formule 220-âge). */
export function computeHrZone(avgHeartRate: number, ageYears: number): HrZone {
  const maxHr = computeMaxHr(ageYears)
  const pct = (avgHeartRate / maxHr) * 100
  if (pct < 60) return 1
  if (pct < 70) return 2
  if (pct < 80) return 3
  if (pct < 90) return 4
  return 5
}
