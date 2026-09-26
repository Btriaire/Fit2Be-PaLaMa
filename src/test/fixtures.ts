import type { Settings } from '../lib/settings'

/** Profil de référence : homme 30 ans, 75 kg, 175 cm. */
export const PROFILE: Settings = {
  firstName: 'Test',
  lastName: 'Utilisateur',
  bodyWeightKg: 75,
  heightCm: 175,
  ageYears: 30,
  sex: 'homme',
  dailyCalorieTarget: 2400,
  restTimerDefaultSec: 90,
  restingHeartRateBpm: 60,
  sleepTargetMin: 480,
  motivationVoice: 'off',
}

export const FEMALE: Settings = { ...PROFILE, sex: 'femme', bodyWeightKg: 60, heightCm: 165 }
