// ---- Gym / Fitness ----

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  equipment?: string
  /** Photos démonstratives (Free Exercise DB, domaine public) — [position de départ, position finale]. */
  images?: string[]
}

export interface SetEntry {
  id: string
  exerciseId: string
  weightKg: number
  reps: number
  rpe?: number
  isWarmup: boolean
  isPr: boolean
  completedAt: number
  /** FC mesurée pendant le repos qui suit cette série (caméra) — plus
   * précis que la FC moyenne de la séance pour évaluer l'effort cardiaque
   * réel de CETTE série spécifique. */
  heartRateBpm?: number
}

export interface WorkoutExercise {
  exerciseId: string
  order: number
  sets: SetEntry[]
  /** Prescription d'un template d'entraînement (nb de séries visé). */
  targetSets?: number
  /** Prescription d'un template d'entraînement (ex: "8-10", "AMRAP"). */
  targetReps?: string
  /** Chef musculaire ciblé + repère technique, affiché sous l'exercice. */
  note?: string
  /** Rythme cardiaque associé à cet exercice, mesuré via la caméra ou repris de Google Fit. */
  heartRateBpm?: number
  heartRateMeasuredAt?: number
  heartRateSource?: 'camera' | 'googlefit'
}

export interface Workout {
  id: string
  name: string
  startedAt: number
  finishedAt?: number
  exercises: WorkoutExercise[]
  notes?: string
}

export interface CustomTemplateExercise {
  exerciseId: string
  targetSets?: number
  targetReps?: string
}

/** Modèle de séance personnalisé, sauvegardé depuis une séance en cours —
 * même principe que les templates par chef musculaire, mais créé par
 * l'utilisateur, réutilisable depuis "Mes modèles" sur l'accueil Gym. */
export interface CustomTemplate {
  id: string
  name: string
  /** Miniature compressée en data URL (jamais l'image d'origine — voir compressImageToDataUrl). */
  photoDataUrl?: string
  exercises: CustomTemplateExercise[]
  createdAt: number
}

// ---- Activités quotidiennes ----

export type ActivityCategory = 'gym' | 'outdoor' | 'loisir' | 'quotidien' | 'bureau' | 'deplacement'

export interface ActivityLog {
  id: string
  category: ActivityCategory
  label: string
  metValue: number
  durationMin: number
  caloriesBurned: number
  loggedAt: number
  notes?: string
  /** id de l'entrée côté NutriTracker si importée de là-bas — sert à ne
   * jamais réimporter deux fois la même activité. */
  externalId?: string
}

// ---- Endurance ----

export type EnduranceActivityType = 'course' | 'velo' | 'natation' | 'rameur' | 'velo-appart' | 'tapis' | 'marche'

export type HrZone = 1 | 2 | 3 | 4 | 5

export interface RoutePoint {
  lat: number
  lng: number
  ts: number
}

/** Toutes les métriques lues sur l'écran d'une machine de cardio scannée —
 * conservées telles quelles, même celles non (encore) utilisées ailleurs. */
export interface MachineStats {
  machineType: 'treadmill' | 'bike' | 'rower' | 'elliptical' | 'other'
  avgWatts?: number
  avgSpeedKph?: number
  avgMets?: number
  peakHeartRate?: number
  peakWatts?: number
  peakSpeedKph?: number
  elevationGainM?: number
}

export interface EnduranceSession {
  id: string
  activityType: EnduranceActivityType
  startedAt: number
  durationMin: number
  distanceKm?: number
  avgHeartRate?: number
  hrZone?: HrZone
  caloriesBurned: number
  notes?: string
  route?: RoutePoint[]
  machineStats?: MachineStats
  /** Capture de l'écran machine scanné (miniature en liste, plein écran au tap). */
  photoDataUrl?: string
  /** Difficulté ressentie (0-10, session-RPE) — saisie après une séance live
   * (chrono indoor), prioritaire sur la FC/MET pour l'estimation de charge. */
  rpe?: number
  /** id de l'entrée côté NutriTracker si importée de là-bas — sert à ne
   * jamais réimporter deux fois la même activité. */
  externalId?: string
}

// ---- Récupération & Santé ----

export interface RecoveryCheckin {
  id: string
  date: string // YYYY-MM-DD
  sleepQuality: 1 | 2 | 3 | 4 | 5
  sleepHours?: number
  muscleFatigue: 1 | 2 | 3 | 4 | 5
  stressLevel: 1 | 2 | 3 | 4 | 5
  motivation: 1 | 2 | 3 | 4 | 5
  bodyBatteryScore: number // 0-100 computed
  notes?: string
}

// ---- NutriTracker ----

export interface NutritionEntry {
  id: string
  loggedAt: number
  label: string
  calories: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  sugarG?: number
  rawInput?: string
}

export interface WeightLog {
  id: string
  loggedAt: number
  weightKg: number
}

export interface UserSettings {
  dailyCalorieTarget: number
  restTimerDefaultSec: number
  units: 'kg' | 'lb'
}

// ---- Photo du jour (Dashboard) ----

export interface DailyPhoto {
  /** Égal à `date` — clé primaire du store, nommée `id` pour rester compatible
   * avec le mécanisme générique de cloudSync/restore (voir SYNCABLE_STORES). */
  id: string
  date: string // YYYY-MM-DD
  dataUrl: string
  createdAt: number
}

// ---- Google Fit (lu depuis NutriTracker, pas d'OAuth propre à cette app) ----

export interface GoogleFitDay {
  date: string // YYYY-MM-DD, clé primaire
  steps: number
  activeCaloriesBurned: number
  activeMinutes: number
  heartRateAvg: number | null
  sleepMinutes: number | null
  syncedAt: number
}
