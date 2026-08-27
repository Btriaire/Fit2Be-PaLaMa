import { getDb, newId } from './db'
import { pushRecord, deleteRecord } from './cloudSync'
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

const MAX_DIMENSION = 320
const JPEG_QUALITY = 0.72

/** Redimensionne + recompresse une photo choisie par l'utilisateur avant de
 * la stocker en IndexedDB — l'original d'un appareil photo peut peser
 * plusieurs Mo, une miniature 320px en JPEG suffit largement pour l'usage
 * (petite vignette dans une liste de modèles). */
export function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas unsupported'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image decode failed'))
    }
    img.src = url
  })
}
