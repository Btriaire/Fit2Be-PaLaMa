import { getDb } from './db'
import { pushRecord } from './cloudSync'
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
  return photo
}
