import type { Exercise } from '../types'

export const SEED_EXERCISES: Exercise[] = [
  { id: 'bench-press', name: 'Développé couché', muscleGroup: 'Pectoraux', equipment: 'Barre' },
  { id: 'squat', name: 'Squat', muscleGroup: 'Jambes', equipment: 'Barre' },
  { id: 'deadlift', name: 'Soulevé de terre', muscleGroup: 'Dos', equipment: 'Barre' },
  { id: 'overhead-press', name: 'Développé militaire', muscleGroup: 'Épaules', equipment: 'Barre' },
  { id: 'pull-up', name: 'Tractions', muscleGroup: 'Dos', equipment: 'Poids du corps' },
  { id: 'barbell-row', name: 'Rowing barre', muscleGroup: 'Dos', equipment: 'Barre' },
  { id: 'dips', name: 'Dips', muscleGroup: 'Triceps', equipment: 'Poids du corps' },
  { id: 'leg-press', name: 'Presse à cuisses', muscleGroup: 'Jambes', equipment: 'Machine' },
  { id: 'lat-pulldown', name: 'Tirage vertical', muscleGroup: 'Dos', equipment: 'Machine' },
  { id: 'dumbbell-curl', name: 'Curl haltères', muscleGroup: 'Biceps', equipment: 'Haltères' },
  { id: 'incline-db-press', name: 'Développé incliné haltères', muscleGroup: 'Pectoraux', equipment: 'Haltères' },
  { id: 'leg-curl', name: 'Leg curl', muscleGroup: 'Jambes', equipment: 'Machine' },
]
