import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  ActivityLog,
  CustomTemplate,
  DailyPhoto,
  EnduranceSession,
  Exercise,
  GoogleFitDay,
  NutritionEntry,
  RecoveryCheckin,
  WeightLog,
  Workout,
} from '../types'
import type { CustomEnduranceProgram } from './customEndurancePrograms'

interface VibeFitDB extends DBSchema {
  workouts: { key: string; value: Workout; indexes: { byStartedAt: number } }
  exercises: { key: string; value: Exercise }
  activities: { key: string; value: ActivityLog; indexes: { byLoggedAt: number } }
  recovery: { key: string; value: RecoveryCheckin; indexes: { byDate: string } }
  nutrition: { key: string; value: NutritionEntry; indexes: { byLoggedAt: number } }
  weightLogs: { key: string; value: WeightLog; indexes: { byLoggedAt: number } }
  endurance: { key: string; value: EnduranceSession; indexes: { byStartedAt: number } }
  googleFitDaily: { key: string; value: GoogleFitDay }
  customTemplates: { key: string; value: CustomTemplate; indexes: { byCreatedAt: number } }
  dailyPhotos: { key: string; value: DailyPhoto }
  customEndurancePrograms: { key: string; value: CustomEnduranceProgram; indexes: { byCreatedAt: number } }
}

let dbPromise: Promise<IDBPDatabase<VibeFitDB>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<VibeFitDB>('vibefit', 7, {
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
        if (oldVersion < 5) {
          const customTemplates = db.createObjectStore('customTemplates', { keyPath: 'id' })
          customTemplates.createIndex('byCreatedAt', 'createdAt')
        }
        if (oldVersion < 6) {
          db.createObjectStore('dailyPhotos', { keyPath: 'id' })
        }
        if (oldVersion < 7) {
          const customEndurancePrograms = db.createObjectStore('customEndurancePrograms', { keyPath: 'id' })
          customEndurancePrograms.createIndex('byCreatedAt', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

export function newId() {
  return crypto.randomUUID()
}
