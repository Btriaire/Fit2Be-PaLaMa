import { pushProfileRecord } from './cloudSync'
import { effectiveCalorieTarget } from './calorieTarget'

const KEY = 'vibefit_settings_v1'

export type Sex = 'homme' | 'femme'
export type Goal = 'perte' | 'maintien' | 'prise'
export type CalorieMode = 'manual' | 'auto'

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
  /** Photo de profil, compressée en petite miniature (data URL). */
  profilePhotoDataUrl?: string
  /** Voix de motivation générée à la volée (musculation + cardio) — 'off' désactive. */
  motivationVoice: 'off' | 'coach' | 'calme'
  /** Objectif de composition corporelle — pilote la cible calorique auto. */
  goal: Goal
  /** 'auto' : cible calculée depuis le BMR et l'objectif ; 'manual' : valeur saisie. */
  calorieMode: CalorieMode
  targetWeightKg?: number
  /** Date visée (YYYY-MM-DD) pour atteindre le poids cible. */
  targetDate?: string
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
  motivationVoice: 'off',
  goal: 'maintien',
  calorieMode: 'manual',
}

/** Vrai si l'utilisateur a déjà enregistré un profil (sert à ne pas relancer l'onboarding). */
export function hasStoredSettings(): boolean {
  try {
    return localStorage.getItem(KEY) != null
  } catch {
    return false
  }
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
  pushProfileRecord({
    firstName: next.firstName,
    ageYears: next.ageYears,
    sex: next.sex,
    heightCm: next.heightCm,
    bodyWeightKg: next.bodyWeightKg,
    restingHeartRateBpm: next.restingHeartRateBpm,
    dailyCalorieTarget: effectiveCalorieTarget(next).target,
  })
  return next
}
