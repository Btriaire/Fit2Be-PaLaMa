const KEY = 'vibefit_settings_v1'

export type Sex = 'homme' | 'femme'

export interface Settings {
  firstName: string
  lastName: string
  bodyWeightKg: number
  heightCm: number
  ageYears: number
  sex: Sex
  dailyCalorieTarget: number
  restTimerDefaultSec: number
  /** FC de repos (bpm) — utilisée pour l'estimation du VO2max. 60 = valeur
   * moyenne par défaut pour un adulte non entraîné, à affiner dans Réglages. */
  restingHeartRateBpm: number
  /** Objectif de sommeil (minutes) — sert au calcul de la dette de sommeil. */
  sleepTargetMin: number
}

const DEFAULTS: Settings = {
  firstName: '',
  lastName: '',
  bodyWeightKg: 75,
  heightCm: 175,
  ageYears: 30,
  sex: 'homme',
  dailyCalorieTarget: 2400,
  restTimerDefaultSec: 90,
  restingHeartRateBpm: 60,
  sleepTargetMin: 480,
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(partial: Partial<Settings>) {
  const next = { ...getSettings(), ...partial }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
