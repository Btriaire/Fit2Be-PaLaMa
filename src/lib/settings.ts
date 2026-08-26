const KEY = 'vibefit_settings_v1'

export type Sex = 'homme' | 'femme'

export interface Settings {
  bodyWeightKg: number
  heightCm: number
  ageYears: number
  sex: Sex
  dailyCalorieTarget: number
  restTimerDefaultSec: number
}

const DEFAULTS: Settings = {
  bodyWeightKg: 75,
  heightCm: 175,
  ageYears: 30,
  sex: 'homme',
  dailyCalorieTarget: 2400,
  restTimerDefaultSec: 90,
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
