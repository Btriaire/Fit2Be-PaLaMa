import type { Exercise } from '../types'
import { FREE_EXERCISE_DB } from './freeExerciseDb'

// Exercices "favoris" mis en avant en premier dans les résultats de recherche.
// Photos issues de Free Exercise DB (domaine public), mêmes que la bibliothèque complète.
const FED = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
export const SEED_EXERCISES: Exercise[] = [
  { id: 'bench-press', name: 'Développé couché', muscleGroup: 'Pectoraux', equipment: 'Barre', images: [`${FED}/Barbell_Bench_Press_-_Medium_Grip/0.jpg`, `${FED}/Barbell_Bench_Press_-_Medium_Grip/1.jpg`] },
  { id: 'squat', name: 'Squat', muscleGroup: 'Jambes', equipment: 'Barre', images: [`${FED}/Barbell_Full_Squat/0.jpg`, `${FED}/Barbell_Full_Squat/1.jpg`] },
  { id: 'deadlift', name: 'Soulevé de terre', muscleGroup: 'Dos', equipment: 'Barre', images: [`${FED}/Barbell_Deadlift/0.jpg`, `${FED}/Barbell_Deadlift/1.jpg`] },
  { id: 'overhead-press', name: 'Développé militaire', muscleGroup: 'Épaules', equipment: 'Barre', images: [`${FED}/Standing_Military_Press/0.jpg`, `${FED}/Standing_Military_Press/1.jpg`] },
  { id: 'pull-up', name: 'Tractions', muscleGroup: 'Dos', equipment: 'Poids du corps', images: [`${FED}/Pullups/0.jpg`, `${FED}/Pullups/1.jpg`] },
  { id: 'barbell-row', name: 'Rowing barre', muscleGroup: 'Dos', equipment: 'Barre', images: [`${FED}/Bent_Over_Barbell_Row/0.jpg`, `${FED}/Bent_Over_Barbell_Row/1.jpg`] },
  { id: 'dips', name: 'Dips', muscleGroup: 'Triceps', equipment: 'Poids du corps', images: [`${FED}/Dips_-_Triceps_Version/0.jpg`, `${FED}/Dips_-_Triceps_Version/1.jpg`] },
  { id: 'leg-press', name: 'Presse à cuisses', muscleGroup: 'Jambes', equipment: 'Machine', images: [`${FED}/Leg_Press/0.jpg`, `${FED}/Leg_Press/1.jpg`] },
  { id: 'lat-pulldown', name: 'Tirage vertical', muscleGroup: 'Dos', equipment: 'Machine', images: [`${FED}/Full_Range-Of-Motion_Lat_Pulldown/0.jpg`, `${FED}/Full_Range-Of-Motion_Lat_Pulldown/1.jpg`] },
  { id: 'dumbbell-curl', name: 'Curl haltères', muscleGroup: 'Biceps', equipment: 'Haltères', images: [`${FED}/Dumbbell_Bicep_Curl/0.jpg`, `${FED}/Dumbbell_Bicep_Curl/1.jpg`] },
  { id: 'incline-db-press', name: 'Développé incliné haltères', muscleGroup: 'Pectoraux', equipment: 'Haltères', images: [`${FED}/Incline_Dumbbell_Press/0.jpg`, `${FED}/Incline_Dumbbell_Press/1.jpg`] },
  { id: 'leg-curl', name: 'Leg curl', muscleGroup: 'Jambes', equipment: 'Machine', images: [`${FED}/Lying_Leg_Curls/0.jpg`, `${FED}/Lying_Leg_Curls/1.jpg`] },
]

const seedIds = new Set(SEED_EXERCISES.map((e) => e.id))

/** Bibliothèque complète : favoris en tête, puis la base Free Exercise DB (675 exercices, domaine public). */
export const ALL_EXERCISES: Exercise[] = [...SEED_EXERCISES, ...FREE_EXERCISE_DB.filter((e) => !seedIds.has(e.id))]

export const MUSCLE_GROUPS = Array.from(new Set(ALL_EXERCISES.map((e) => e.muscleGroup))).sort()
export const EQUIPMENT_TYPES = Array.from(new Set(ALL_EXERCISES.map((e) => e.equipment).filter(Boolean))).sort() as string[]
