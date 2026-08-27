// Une couleur fixe par groupe musculaire — partagée entre MuscleBodyMap
// (sélection) et MuscleHeatmap (intensité), et par tout futur usage
// (légendes, graphiques) qui bénéficie d'un code couleur cohérent dans
// toute l'app plutôt qu'une seule teinte "sélectionné" générique.
export const MUSCLE_GROUP_COLOR: Record<string, string> = {
  Trapèzes: '#8b5cf6',
  Épaules: '#3b82f6',
  Pectoraux: '#f97316',
  Biceps: '#ec4899',
  Triceps: '#06b6d4',
  'Avant-bras': '#38bdf8',
  Abdominaux: '#2dd4bf',
  Dos: '#22c55e',
  'Milieu du dos': '#84cc16',
  'Bas du dos': '#eab308',
  Fessiers: '#f59e0b',
  Adducteurs: '#fbbf24',
  Abducteurs: '#a78bfa',
  Quadriceps: '#ef4444',
  'Ischio-jambiers': '#f43f5e',
  Mollets: '#c026d3',
  Nuque: '#60a5fa',
}

export function colorForMuscleGroup(group: string): string {
  return MUSCLE_GROUP_COLOR[group] ?? '#e2361c'
}
