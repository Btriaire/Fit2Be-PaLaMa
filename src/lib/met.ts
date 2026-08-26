import type { ActivityCategory } from '../types'

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

export const CATEGORY_META: Record<ActivityCategory, { label: string; emoji: string; color: string }> = {
  gym: { label: 'Gym / Fitness', emoji: '🏋️‍♂️', color: 'var(--color-gym)' },
  outdoor: { label: 'Sport Outdoor', emoji: '🟢', color: 'var(--color-outdoor)' },
  loisir: { label: 'Loisir', emoji: '🔵', color: 'var(--color-loisir)' },
  quotidien: { label: 'Quotidien', emoji: '🟠', color: 'var(--color-quotidien)' },
}
