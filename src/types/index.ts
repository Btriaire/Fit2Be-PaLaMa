// ---- Gym / Fitness ----

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  equipment?: string
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
}

export interface WorkoutExercise {
  exerciseId: string
  order: number
  sets: SetEntry[]
}

export interface Workout {
  id: string
  name: string
  startedAt: number
  finishedAt?: number
  exercises: WorkoutExercise[]
  notes?: string
}

// ---- Activités quotidiennes ----

export type ActivityCategory = 'gym' | 'outdoor' | 'loisir' | 'quotidien'

export interface ActivityLog {
  id: string
  category: ActivityCategory
  label: string
  metValue: number
  durationMin: number
  caloriesBurned: number
  loggedAt: number
  notes?: string
}

// ---- Endurance ----

export type EnduranceActivityType = 'course' | 'velo' | 'natation' | 'rameur' | 'velo-appart' | 'tapis' | 'marche'

export type HrZone = 1 | 2 | 3 | 4 | 5

export interface RoutePoint {
  lat: number
  lng: number
  ts: number
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
