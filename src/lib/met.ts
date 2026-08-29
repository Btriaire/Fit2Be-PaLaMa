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

export type BmiCategory = 'insuffisance pondérale' | 'corpulence normale' | 'surpoids' | 'obésité'

/** IMC = poids(kg) / taille(m)² — recalculé à chaque changement de poids
 * (settings.bodyWeightKg est déjà mis à jour par les pesées synchronisées). */
export function computeBmi(settings: Settings): number {
  const heightM = settings.heightCm / 100
  return Math.round((settings.bodyWeightKg / (heightM * heightM)) * 10) / 10
}

/** Classification OMS (WHO Technical Report Series 894, 2000). */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'insuffisance pondérale'
  if (bmi < 25) return 'corpulence normale'
  if (bmi < 30) return 'surpoids'
  return 'obésité'
}

/** % de masse grasse estimé à partir de l'IMC (Deurenberg, Weststrate &
 * Seidell, 1991, British Journal of Nutrition, "Body mass index as a measure
 * of body fatness: age- and sex-specific prediction formulas") — évite
 * d'exiger une mesure d'impédance ou de plis cutanés pour dériver la masse
 * maigre utilisée ailleurs (charge relative, énergie de repos). */
export function computeBodyFatPercent(settings: Settings): number {
  const bmi = computeBmi(settings)
  const sexTerm = settings.sex === 'homme' ? 1 : 0
  const pct = 1.2 * bmi + 0.23 * settings.ageYears - 10.8 * sexTerm - 5.4
  return Math.round(Math.max(3, Math.min(60, pct)) * 10) / 10
}

/** Masse maigre (kg) dérivée du poids total et du %masse grasse (Deurenberg 1991). */
export function computeLeanMassKg(settings: Settings): number {
  const fatPct = computeBodyFatPercent(settings)
  return Math.round(settings.bodyWeightKg * (1 - fatPct / 100) * 10) / 10
}

/** Surface corporelle (formule de Mosteller, 1987) — plus simple et tout
 * aussi fiable que Du Bois pour un usage courant, largement utilisée en
 * clinique pour normaliser des mesures physiologiques (ex : index cardiaque)
 * à la taille du corps plutôt qu'au seul poids. */
export function computeBsa(settings: Settings): number {
  const bsa = Math.sqrt((settings.heightCm * settings.bodyWeightKg) / 3600)
  return Math.round(bsa * 100) / 100
}

export interface BodyComposition {
  bmi: number
  category: BmiCategory
  bodyFatPct: number
  leanMassKg: number
  bsaM2: number
}

/** Regroupe les métriques dérivées de l'IMC — recalculées à chaque appel
 * depuis settings.bodyWeightKg, donc toujours à jour avec la dernière pesée. */
export function computeBodyComposition(settings: Settings): BodyComposition {
  const bmi = computeBmi(settings)
  return {
    bmi,
    category: bmiCategory(bmi),
    bsaM2: computeBsa(settings),
    bodyFatPct: computeBodyFatPercent(settings),
    leanMassKg: computeLeanMassKg(settings),
  }
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

// MET repère par palier d'intensité de phase de programme coaching (Compendium
// of Physical Activities — facile ≈ marche/pédalage léger, modéré ≈ zone 2,
// dur ≈ effort proche du seuil/sprint). Plus fin qu'un MET unique pour toute
// la séance : une séance fractionnée alterne des phases d'intensité très
// différente, les moyenner masque l'essentiel du coût énergétique réel.
const PHASE_INTENSITY_MET: Record<'facile' | 'modéré' | 'dur', number> = {
  facile: 4,
  modéré: 7,
  dur: 11,
}

/** Calories intégrées phase par phase (durée réelle, pas la durée planifiée —
 * une phase passée avec "Passer" ou une séance arrêtée en cours de phase ne
 * doit pas être comptée sur sa durée prévue). */
export function computeCaloriesFromPhaseLog(
  phaseLog: Array<{ intensity: 'facile' | 'modéré' | 'dur'; actualSec: number }>,
  settings: Settings,
): number {
  const sexFactor = settings.sex === 'femme' ? 0.95 : 1
  const total = phaseLog.reduce(
    (sum, p) => sum + PHASE_INTENSITY_MET[p.intensity] * settings.bodyWeightKg * (p.actualSec / 3600) * sexFactor,
    0,
  )
  return Math.round(total)
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
