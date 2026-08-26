import { getDb, newId } from './db'
import { saveSettings } from './settings'
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
  saveSettings({ bodyWeightKg: weightKg })
  return entry
}

export async function deleteWeightLog(id: string) {
  const db = await getDb()
  await db.delete('weightLogs', id)
}
