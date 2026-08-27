import type { ActivityCategory } from '../types'
import type { Settings } from './settings'

export interface MetActivity {
  id: string
  label: string
  category: ActivityCategory
  met: number
  // Code d'activité Google Fit repris par NutriTracker Palama pour l'icône/le
  // libellé de son flux d'activités (app/lib/google-fit.ts:ACTIVITY_LABELS) —
  // 97 = fallback générique quand aucun code Google Fit ne correspond.
  googleFitType: number
}

// Coefficients MET (Compendium of Physical Activities, valeurs usuelles arrondies)
export const MET_ACTIVITIES: MetActivity[] = [
  // Sport outdoor
  { id: 'running-10kmh', label: 'Course à pied (10 km/h)', category: 'outdoor', met: 10, googleFitType: 41 },
  { id: 'running-8kmh', label: 'Course à pied (8 km/h)', category: 'outdoor', met: 8.3, googleFitType: 41 },
  { id: 'cycling-moderate', label: 'Vélo (modéré)', category: 'outdoor', met: 8, googleFitType: 7 },
  { id: 'swimming', label: 'Natation', category: 'outdoor', met: 7, googleFitType: 93 },
  { id: 'hiking', label: 'Randonnée', category: 'outdoor', met: 6, googleFitType: 19 },
  { id: 'walking-brisk', label: 'Marche rapide', category: 'outdoor', met: 4.3, googleFitType: 75 },
  { id: 'football', label: 'Football', category: 'outdoor', met: 8, googleFitType: 45 },
  { id: 'tennis', label: 'Tennis', category: 'outdoor', met: 7.3, googleFitType: 72 },
  { id: 'basketball', label: 'Basketball', category: 'outdoor', met: 6.5, googleFitType: 84 },
  // Loisir
  { id: 'yoga', label: 'Yoga', category: 'loisir', met: 2.5, googleFitType: 82 },
  { id: 'dancing', label: 'Danse', category: 'loisir', met: 4.8, googleFitType: 83 },
  { id: 'climbing-indoor', label: 'Escalade en salle', category: 'loisir', met: 7.5, googleFitType: 48 },
  { id: 'golf', label: 'Golf', category: 'loisir', met: 4.3, googleFitType: 97 },
  { id: 'playing-with-kids', label: 'Jouer avec les enfants', category: 'loisir', met: 3, googleFitType: 97 },
  { id: 'stretching', label: 'Étirements', category: 'loisir', met: 2.3, googleFitType: 61 },
  { id: 'pilates', label: 'Pilates', category: 'loisir', met: 3, googleFitType: 108 },
  // Quotidien / obligatoire
  { id: 'gardening', label: 'Jardinage', category: 'quotidien', met: 4, googleFitType: 97 },
  { id: 'house-cleaning', label: 'Ménage', category: 'quotidien', met: 3.3, googleFitType: 97 },
  { id: 'grocery-shopping', label: 'Courses (magasins)', category: 'quotidien', met: 2.3, googleFitType: 97 },
  { id: 'stairs', label: 'Montée d\'escaliers', category: 'quotidien', met: 8.8, googleFitType: 55 },
  { id: 'carrying-groceries', label: 'Porter les courses', category: 'quotidien', met: 4, googleFitType: 97 },
  { id: 'diy', label: 'Bricolage', category: 'quotidien', met: 4.5, googleFitType: 97 },
  { id: 'car-washing', label: 'Laver la voiture', category: 'quotidien', met: 3.5, googleFitType: 97 },
  // Au bureau — faisable sur place, peu de matériel
  { id: 'desk-stretching', label: 'Étirements (pause bureau)', category: 'bureau', met: 2.3, googleFitType: 61 },
  { id: 'standing-desk', label: 'Poste debout', category: 'bureau', met: 1.8, googleFitType: 97 },
  { id: 'office-stairs', label: "Pause escaliers (bureau)", category: 'bureau', met: 8, googleFitType: 55 },
  { id: 'walking-meeting', label: 'Réunion en marchant', category: 'bureau', met: 3.3, googleFitType: 75 },
  { id: 'chair-exercises', label: 'Exercices sur chaise (gainage, mollets)', category: 'bureau', met: 2.8, googleFitType: 97 },
  // Déplacement professionnel — aéroport, train, correspondances : dépense
  // notable (marche + bagages + station debout prolongée), impacte la fatigue.
  { id: 'airport-connection', label: 'Aéroport / gare (bagages, correspondance)', category: 'deplacement', met: 4, googleFitType: 97 },
  { id: 'train-travel', label: 'Trajet train / avion (assis, prolongé)', category: 'deplacement', met: 1.5, googleFitType: 97 },
]

// Formule standard : kcal = MET x poids(kg) x durée(h)
export function computeCalories(met: number, weightKg: number, durationMin: number) {
  return Math.round(met * weightKg * (durationMin / 60))
}

/**
 * Calcul des calories brûlées pour une activité en tenant compte du profil
 * démographique de l'utilisateur (poids + léger ajustement selon le sexe,
 * la masse maigre moyenne étant plus élevée chez les hommes à poids égal).
 */
export function computeCaloriesForUser(met: number, durationMin: number, settings: Settings) {
  const sexFactor = settings.sex === 'femme' ? 0.95 : 1
  return Math.round(met * settings.bodyWeightKg * (durationMin / 60) * sexFactor)
}

/** Métabolisme de base (Mifflin-St Jeor), en kcal/jour. */
export function computeBmr(settings: Settings) {
  const base = 10 * settings.bodyWeightKg + 6.25 * settings.heightCm - 5 * settings.ageYears
  return Math.round(settings.sex === 'homme' ? base + 5 : base - 161)
}

/**
 * Calcul des calories à partir de la FC moyenne réelle (formule de régression
 * de Keytel et al., 2005) — plus précis qu'un MET générique par type
 * d'activité puisqu'il reflète l'intensité effectivement fournie par le corps
 * plutôt qu'une moyenne théorique pour "cette activité". Valide pour un
 * effort soutenu (FC nettement au-dessus du repos) ; en-dessous, la
 * régression n'est plus fiable et on retombe sur l'estimation MET classique.
 */
export function computeCaloriesFromHr(avgHeartRate: number, durationMin: number, settings: Settings): number | null {
  if (avgHeartRate < 90) return null
  const { bodyWeightKg: weight, ageYears: age, sex } = settings
  const kcalPerMin =
    sex === 'homme'
      ? (-55.0969 + 0.6309 * avgHeartRate + 0.1988 * weight + 0.2017 * age) / 4.184
      : (-20.4022 + 0.4472 * avgHeartRate - 0.1263 * weight + 0.074 * age) / 4.184
  return Math.max(0, Math.round(kcalPerMin * durationMin))
}

/**
 * Calories NEAT (Non-Exercise Activity Thermogenesis) à partir du nombre de
 * pas — l'activité "non sportive" de la journée (marcher au bureau, monter
 * des escaliers, etc.), distincte des séances de sport déjà comptées
 * ailleurs. Approximation courante ≈ 0.0005 kcal par pas et par kg de poids
 * corporel (≈ 350 kcal pour 10 000 pas chez un adulte de 70 kg, cohérent
 * avec les ordres de grandeur habituellement cités).
 */
export function computeCaloriesFromSteps(steps: number, settings: Settings): number {
  return Math.round(steps * 0.0005 * settings.bodyWeightKg)
}

// MET usuel pour une séance de musculation (charges libres/machines, effort modéré à soutenu)
export const GYM_WORKOUT_MET = 5.5

export const CATEGORY_META: Record<ActivityCategory, { label: string; emoji: string; color: string }> = {
  gym: { label: 'Gym / Fitness', emoji: '🏋️‍♂️', color: 'var(--color-orange)' },
  outdoor: { label: 'Sport Outdoor', emoji: '🟢', color: 'var(--color-turquoise)' },
  loisir: { label: 'Loisir', emoji: '🔵', color: 'var(--color-turquoise)' },
  quotidien: { label: 'Quotidien', emoji: '🟠', color: 'var(--color-turquoise)' },
  bureau: { label: 'Au bureau', emoji: '🧑‍💻', color: 'var(--color-turquoise)' },
  deplacement: { label: 'Déplacement pro', emoji: '🧳', color: 'var(--color-turquoise)' },
}
