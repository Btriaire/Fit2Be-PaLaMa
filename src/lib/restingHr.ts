// Résout la FC de repos à utiliser pour VO2max (et autres calculs qui en ont
// besoin) par ordre de fiabilité décroissant :
// 1. FC repos remontée par NutriTracker (Apple Watch/Withings — vraie mesure
//    au réveil, la plus fiable).
// 2. FC mesurée par l'utilisateur lui-même via la caméra pendant les repos
//    entre séries (mode Focus) — pas une vraie FC repos, mais la valeur la
//    plus basse récente s'en rapproche mieux qu'un chiffre saisi une fois.
// 3. Valeur saisie dans Réglages — dernier recours, seulement si rien de
//    mesuré n'est disponible.

import { getAllWorkouts } from './workouts'
import { pullCardiacRangeFromNutriTracker } from './nutriTrackerSync'
import type { Settings } from './settings'

export interface RestingHrResolution {
  bpm: number
  source: 'nutritracker' | 'mesure-app' | 'config'
}

export async function resolveRestingHr(settings: Settings): Promise<RestingHrResolution> {
  try {
    const cardiac = await pullCardiacRangeFromNutriTracker(14)
    const withResting = cardiac.find((d) => d.heartRateResting != null)
    if (withResting?.heartRateResting) return { bpm: withResting.heartRateResting, source: 'nutritracker' }
  } catch {
    // best effort — on retombe sur les sources suivantes
  }

  const workouts = await getAllWorkouts()
  const cutoff = Date.now() - 14 * 86_400_000
  const recentHr = workouts
    .filter((w) => w.startedAt >= cutoff)
    .flatMap((w) => w.exercises.flatMap((e) => e.sets))
    .map((s) => s.heartRateBpm)
    .filter((bpm): bpm is number => bpm != null)
  if (recentHr.length > 0) {
    return { bpm: Math.min(...recentHr), source: 'mesure-app' }
  }

  return { bpm: settings.restingHeartRateBpm, source: 'config' }
}
