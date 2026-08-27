import { getDb, newId } from './db'
import { pushRecord, deleteRecord } from './cloudSync'
export { compressImageToDataUrl } from './image'
import type { CustomTemplate, CustomTemplateExercise, Workout } from '../types'

export async function getCustomTemplates(): Promise<CustomTemplate[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('customTemplates', 'byCreatedAt')
  return all.reverse()
}

export async function saveCustomTemplate(name: string, exercises: CustomTemplateExercise[], photoDataUrl?: string): Promise<CustomTemplate> {
  const db = await getDb()
  const template: CustomTemplate = { id: newId(), name, exercises, photoDataUrl, createdAt: Date.now() }
  await db.put('customTemplates', template)
  pushRecord('customTemplates', template.id, template)
  return template
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('customTemplates', id)
  deleteRecord('customTemplates', id)
}

/** Extrait exerciseId + prescription cible (si connue, sinon vide) depuis une
 * séance en cours — sert de base à "Enregistrer comme modèle". */
export function exercisesFromWorkout(workout: Workout): CustomTemplateExercise[] {
  return workout.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((we) => ({ exerciseId: we.exerciseId, targetSets: we.targetSets, targetReps: we.targetReps }))
}

