import type { ActivityCategory } from '../types'
import type { Settings } from './settings'

export interface MetActivity {
  id: string
  label: string
  category: ActivityCategory
  met: number
}

// Coefficients MET (Compendium of Physical Activities, valeurs usuelles arrondies)
export const MET_ACTIVITIES: MetActivity[] = [
  // Sport outdoor
  { id: 'running-10kmh', label: 'Course à pied (10 km/h)', category: 'outdoor', met: 10 },
  { id: 'running-8kmh', label: 'Course à pied (8 km/h)', category: 'outdoor', met: 8.3 },
  { id: 'cycling-moderate', label: 'Vélo (modéré)', category: 'outdoor', met: 8 },
  { id: 'swimming', label: 'Natation', category: 'outdoor', met: 7 },
  { id: 'hiking', label: 'Randonnée', category: 'outdoor', met: 6 },
  { id: 'walking-brisk', label: 'Marche rapide', category: 'outdoor', met: 4.3 },
  { id: 'football', label: 'Football', category: 'outdoor', met: 8 },
  { id: 'tennis', label: 'Tennis', category: 'outdoor', met: 7.3 },
  { id: 'basketball', label: 'Basketball', category: 'outdoor', met: 6.5 },
  // Loisir
  { id: 'yoga', label: 'Yoga', category: 'loisir', met: 2.5 },
  { id: 'dancing', label: 'Danse', category: 'loisir', met: 4.8 },
  { id: 'climbing-indoor', label: 'Escalade en salle', category: 'loisir', met: 7.5 },
  { id: 'golf', label: 'Golf', category: 'loisir', met: 4.3 },
  { id: 'playing-with-kids', label: 'Jouer avec les enfants', category: 'loisir', met: 3 },
  // Quotidien / obligatoire
  { id: 'gardening', label: 'Jardinage', category: 'quotidien', met: 4 },
  { id: 'house-cleaning', label: 'Ménage', category: 'quotidien', met: 3.3 },
  { id: 'grocery-shopping', label: 'Courses (magasins)', category: 'quotidien', met: 2.3 },
  { id: 'stairs', label: 'Montée d\'escaliers', category: 'quotidien', met: 8.8 },
  { id: 'carrying-groceries', label: 'Porter les courses', category: 'quotidien', met: 4 },
  { id: 'diy', label: 'Bricolage', category: 'quotidien', met: 4.5 },
  { id: 'car-washing', label: 'Laver la voiture', category: 'quotidien', met: 3.5 },
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

// MET usuel pour une séance de musculation (charges libres/machines, effort modéré à soutenu)
export const GYM_WORKOUT_MET = 5.5

export const CATEGORY_META: Record<ActivityCategory, { label: string; emoji: string; color: string }> = {
  gym: { label: 'Gym / Fitness', emoji: '🏋️‍♂️', color: 'var(--color-orange)' },
  outdoor: { label: 'Sport Outdoor', emoji: '🟢', color: 'var(--color-turquoise)' },
  loisir: { label: 'Loisir', emoji: '🔵', color: 'var(--color-turquoise)' },
  quotidien: { label: 'Quotidien', emoji: '🟠', color: 'var(--color-turquoise)' },
}
