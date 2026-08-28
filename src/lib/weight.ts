import { getDb, newId } from './db'
import { saveSettings } from './settings'
import { pushWeightToNutriTracker, pullLatestWeightFromNutriTracker } from './nutriTrackerSync'
import { pushRecord, deleteRecord } from './cloudSync'
import type { WeightLog } from '../types'

export async function getWeightLogs(): Promise<WeightLog[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('weightLogs', 'byLoggedAt')
  return all.reverse()
}

/** Enregistre une pesée et met à jour le profil (poids courant utilisé dans tous les calculs). */
export async function logWeight(weightKg: number, loggedAt = Date.now()): Promise<WeightLog> {
  const db = await getDb()
  const entry: WeightLog = { id: newId(), loggedAt, weightKg }
  await db.put('weightLogs', entry)
  pushRecord('weightLogs', entry.id, entry)
  saveSettings({ bodyWeightKg: weightKg })
  const date = new Date(loggedAt).toISOString().slice(0, 10)
  void pushWeightToNutriTracker(weightKg, date)
  return entry
}

export async function deleteWeightLog(id: string) {
  const db = await getDb()
  await db.delete('weightLogs', id)
  deleteRecord('weightLogs', id)
}

/**
 * Adopte une pesée reçue de NutriTracker Palama (ex: Withings) sans la
 * repousser vers NutriTracker — évite un aller-retour infini entre les deux
 * apps. Utilisé uniquement par le pull au chargement de NutriTracker.
 */
export async function adoptWeightFromSync(weightKg: number, dateStr: string): Promise<WeightLog | null> {
  const db = await getDb()
  const existing = await db.getAllFromIndex('weightLogs', 'byLoggedAt')
  const alreadyLogged = existing.some((w) => new Date(w.loggedAt).toISOString().slice(0, 10) === dateStr)
  if (alreadyLogged) return null

  const loggedAt = new Date(`${dateStr}T12:00:00`).getTime()
  const entry: WeightLog = { id: newId(), loggedAt, weightKg }
  await db.put('weightLogs', entry)
  pushRecord('weightLogs', entry.id, entry)
  saveSettings({ bodyWeightKg: weightKg })
  return entry
}

/**
 * Tire la dernière pesée connue de NutriTracker Palama et met à jour le
 * profil si elle n'est pas déjà connue localement — sans ça, settings.bodyWeightKg
 * (utilisé par tous les calculs dérivés du poids : IMC, BMR, calories) ne
 * restait à jour que si l'utilisateur passait par la page Diet, qui seule
 * appelait ce pull. Appelé globalement au démarrage/premier plan (App.tsx)
 * pour que l'IMC etc. soient toujours corrects, page Diet visitée ou non.
 */
export async function syncLatestWeightFromNutriTracker(): Promise<boolean> {
  const pulled = await pullLatestWeightFromNutriTracker()
  if (!pulled.weightKg || !pulled.date) return false
  const adopted = await adoptWeightFromSync(pulled.weightKg, pulled.date)
  return adopted != null
}
