import type { HrZone } from '../types'

export const HR_ZONE_META: Record<HrZone, { label: string; color: string; range: string }> = {
  1: { label: 'Récupération', color: '#38bdf8', range: '50-60% FCR' },
  2: { label: 'Zone 2 (endurance)', color: '#22c55e', range: '60-70% FCR' },
  3: { label: 'Aérobie', color: '#facc15', range: '70-80% FCR' },
  4: { label: 'Seuil', color: '#e2361c', range: '80-90% FCR' },
  5: { label: 'Maximal', color: '#ef4444', range: '90-100% FCR' },
}

/** FC max estimée : Tanaka (208 − 0,7 × âge). Plus juste que 220 − âge, qui sous-estime après 40 ans. */
export function computeMaxHr(ageYears: number) {
  return Math.round(208 - 0.7 * ageYears)
}

/** Borne basse de chaque zone, en fraction de la FC de réserve (Karvonen) : Z1 = 50 %, Z2 = 60 %... */
const ZONE_LOWER_FRACTIONS = [0.5, 0.6, 0.7, 0.8, 0.9]

/**
 * Zone FC (1-5) d'une FC moyenne. Avec la FC de repos, le calcul se fait sur la
 * FC de réserve (Karvonen : (FC − repos) / (max − repos)), plus personnel qu'un
 * simple % de la FC max ; sans elle, on retombe sur le % de la FC max.
 */
export function computeHrZone(avgHeartRate: number, ageYears: number, restingHr?: number): HrZone {
  const maxHr = computeMaxHr(ageYears)
  const useReserve = restingHr != null && restingHr > 0 && restingHr < maxHr
  const frac = useReserve ? (avgHeartRate - restingHr) / (maxHr - restingHr) : avgHeartRate / maxHr
  if (frac < 0.6) return 1
  if (frac < 0.7) return 2
  if (frac < 0.8) return 3
  if (frac < 0.9) return 4
  return 5
}

export interface ZoneBounds {
  zone: HrZone
  minBpm: number
  maxBpm: number
}

/** Fourchettes de FC (bpm) de chaque zone pour ce profil — ce qu'on affiche à l'utilisateur. */
export function zoneBoundsBpm(ageYears: number, restingHr: number): ZoneBounds[] {
  const maxHr = computeMaxHr(ageYears)
  const rest = restingHr > 0 && restingHr < maxHr ? restingHr : 0
  const at = (f: number) => Math.round(rest + f * (maxHr - rest))
  return ZONE_LOWER_FRACTIONS.map((lo, i) => ({
    zone: (i + 1) as HrZone,
    minBpm: at(lo),
    maxBpm: at(i === 4 ? 1 : ZONE_LOWER_FRACTIONS[i + 1]),
  }))
}
