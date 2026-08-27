import type { Slug } from 'react-muscle-highlighter'

// Correspondance entre la taxonomie française de l'app (Exercise.muscleGroup,
// MUSCLE_GROUPS) et les "slugs" anglais de react-muscle-highlighter (MIT,
// SVG segmenté par groupe musculaire — voir node_modules/react-muscle-highlighter).
// "Dos" et "Milieu du dos" retombent tous les deux sur "upper-back" (la lib
// ne distingue pas plus finement) ; "Abducteurs" n'a pas d'équivalent direct
// (pas de slug dédié) et reste donc non représenté visuellement — le filtre
// texte de la liste d'exercices continue de fonctionner malgré tout.
export const MUSCLE_GROUP_TO_SLUG: Record<string, Slug> = {
  Abdominaux: 'abs',
  Adducteurs: 'adductors',
  'Avant-bras': 'forearm',
  'Bas du dos': 'lower-back',
  Biceps: 'biceps',
  Dos: 'upper-back',
  Fessiers: 'gluteal',
  'Ischio-jambiers': 'hamstring',
  'Milieu du dos': 'upper-back',
  Mollets: 'calves',
  Nuque: 'neck',
  Pectoraux: 'chest',
  Quadriceps: 'quadriceps',
  Trapèzes: 'trapezius',
  Triceps: 'triceps',
  Épaules: 'deltoids',
}

export function slugForMuscleGroup(group: string): Slug | null {
  return MUSCLE_GROUP_TO_SLUG[group] ?? null
}

// Inverse — un slug peut correspondre à plusieurs groupes FR (upper-back).
// Utilisé pour retrouver le(s) groupe(s) FR au clic sur une zone du dessin.
export const SLUG_TO_MUSCLE_GROUPS: Partial<Record<Slug, string[]>> = Object.entries(MUSCLE_GROUP_TO_SLUG).reduce(
  (acc, [group, slug]) => {
    ;(acc[slug] ??= []).push(group)
    return acc
  },
  {} as Partial<Record<Slug, string[]>>,
)
