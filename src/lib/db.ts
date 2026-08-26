import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ActivityLog, Exercise, NutritionEntry, RecoveryCheckin, Workout } from '../types'

interface VibeFitDB extends DBSchema {
  workouts: { key: string; value: Workout; indexes: { byStartedAt: number } }
  exercises: { key: string; value: Exercise }
  activities: { key: string; value: ActivityLog; indexes: { byLoggedAt: number } }
  recovery: { key: string; value: RecoveryCheckin; indexes: { byDate: string } }
  nutrition: { key: string; value: NutritionEntry; indexes: { byLoggedAt: number } }
}

let dbPromise: Promise<IDBPDatabase<VibeFitDB>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<VibeFitDB>('vibefit', 1, {
      upgrade(db) {
        const workouts = db.createObjectStore('workouts', { keyPath: 'id' })
        workouts.createIndex('byStartedAt', 'startedAt')

        db.createObjectStore('exercises', { keyPath: 'id' })

        const activities = db.createObjectStore('activities', { keyPath: 'id' })
        activities.createIndex('byLoggedAt', 'loggedAt')

        const recovery = db.createObjectStore('recovery', { keyPath: 'id' })
        recovery.createIndex('byDate', 'date')

        const nutrition = db.createObjectStore('nutrition', { keyPath: 'id' })
        nutrition.createIndex('byLoggedAt', 'loggedAt')
      },
    })
  }
  return dbPromise
}

export function newId() {
  return crypto.randomUUID()
}
