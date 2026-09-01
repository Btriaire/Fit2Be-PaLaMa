import { getDb } from './db'
import { pushRecord, deleteRecord } from './cloudSync'
import { pushDailyPhotoToNutriTracker } from './nutriTrackerSync'
import { todayStr } from './date'
import type { DailyPhoto } from '../types'

export async function getDailyPhoto(date: string = todayStr()): Promise<DailyPhoto | null> {
  const db = await getDb()
  return (await db.get('dailyPhotos', date)) ?? null
}

export async function saveDailyPhoto(dataUrl: string, date: string = todayStr()): Promise<DailyPhoto> {
  const db = await getDb()
  const photo: DailyPhoto = { id: date, date, dataUrl, createdAt: Date.now() }
  await db.put('dailyPhotos', photo)
  pushRecord('dailyPhotos', photo.id, photo)
  void pushDailyPhotoToNutriTracker(dataUrl, date)
  return photo
}

export async function getAllDailyPhotos(): Promise<DailyPhoto[]> {
  const db = await getDb()
  const all = await db.getAll('dailyPhotos')
  return all.sort((a, b) => b.date.localeCompare(a.date))
}

export async function deleteDailyPhoto(id: string) {
  const db = await getDb()
  await db.delete('dailyPhotos', id)
  deleteRecord('dailyPhotos', id)
}
