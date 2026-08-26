import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ActivityLog, EnduranceSession, Exercise, GoogleFitDay, NutritionEntry, RecoveryCheckin, WeightLog, Workout } from '../types'

interface VibeFitDB extends DBSchema {
  workouts: { key: string; value: Workout; indexes: { byStartedAt: number } }
  exercises: { key: string; value: Exercise }
  activities: { key: string; value: ActivityLog; indexes: { byLoggedAt: number } }
  recovery: { key: string; value: RecoveryCheckin; indexes: { byDate: string } }
  nutrition: { key: string; value: NutritionEntry; indexes: { byLoggedAt: number } }
  weightLogs: { key: string; value: WeightLog; indexes: { byLoggedAt: number } }
  endurance: { key: string; value: EnduranceSession; indexes: { byStartedAt: number } }
  googleFitDaily: { key: string; value: GoogleFitDay }
}

let dbPromise: Promise<IDBPDatabase<VibeFitDB>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<VibeFitDB>('vibefit', 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const workouts = db.createObjectStore('workouts', { keyPath: 'id' })
          workouts.createIndex('byStartedAt', 'startedAt')

          db.createObjectStore('exercises', { keyPath: 'id' })

          const activities = db.createObjectStore('activities', { keyPath: 'id' })
          activities.createIndex('byLoggedAt', 'loggedAt')

          const recovery = db.createObjectStore('recovery', { keyPath: 'id' })
          recovery.createIndex('byDate', 'date')

          const nutrition = db.createObjectStore('nutrition', { keyPath: 'id' })
          nutrition.createIndex('byLoggedAt', 'loggedAt')
        }
        if (oldVersion < 2) {
          const weightLogs = db.createObjectStore('weightLogs', { keyPath: 'id' })
          weightLogs.createIndex('byLoggedAt', 'loggedAt')
        }
        if (oldVersion < 3) {
          const endurance = db.createObjectStore('endurance', { keyPath: 'id' })
          endurance.createIndex('byStartedAt', 'startedAt')
        }
        if (oldVersion < 4) {
          db.createObjectStore('googleFitDaily', { keyPath: 'date' })
        }
      },
    })
  }
  return dbPromise
}

export function newId() {
  return crypto.randomUUID()
}
