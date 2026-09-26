import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityLog, EnduranceSession } from '../types'

vi.mock('./cloudSync', () => ({ pushRecord: () => {}, deleteRecord: () => {} }))

import { getDb } from './db'
import { computeAcwr, computeActivityStreak, computeDailyRecovery, enduranceSessionLoad } from './recovery'

const AGE = 30
let seq = 0

function activityAt(daysAgo: number, hour: number, durationMin: number, metValue: number): ActivityLog {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return { id: `a${seq++}`, category: 'loisir', label: 'Sport', metValue, durationMin, caloriesBurned: 0, loggedAt: d.getTime() }
}

async function seed(items: ActivityLog[]) {
  const db = await getDb()
  await Promise.all(items.map((a) => db.put('activities', a)))
}

beforeEach(async () => {
  const db = await getDb()
  await Promise.all([db.clear('activities'), db.clear('endurance'), db.clear('workouts')])
})

describe('charge d’un effort (session-RPE, Foster)', () => {
  const base: EnduranceSession = { id: 'e', activityType: 'course', startedAt: 0, durationMin: 30, caloriesBurned: 0 }

  it('utilise la FC moyenne en priorité (150 bpm à 30 ans ≈ 79 % → RPE 6)', () => {
    const l = enduranceSessionLoad({ ...base, avgHeartRate: 150 }, AGE, 'Course')
    expect(l.effortScore).toBe(6)
    expect(l.load).toBe(180)
  })

  it('sinon le RPE saisi', () => {
    const l = enduranceSessionLoad({ ...base, rpe: 8, durationMin: 45 }, AGE, 'Course')
    expect(l.load).toBe(360)
  })

  it('sinon les METs de l’activité', () => {
    const l = enduranceSessionLoad({ ...base, activityType: 'marche' }, AGE, 'Marche') // MET 4,3 → 3,6
    expect(l.effortScore).toBe(3.6)
    expect(l.load).toBe(108)
  })
})

describe('récupération du jour', () => {
  it('aucun effort = bande « aucune »', async () => {
    const r = await computeDailyRecovery(AGE)
    expect(r.totalLoad).toBe(0)
    expect(r.band).toBe('aucune')
  })

  it('60 min à MET 6 = charge 300 → modérée', async () => {
    await seed([{ ...activityAt(0, 12, 60, 6), loggedAt: Date.now() - 60_000 }])
    const r = await computeDailyRecovery(AGE)
    expect(r.totalLoad).toBe(300)
    expect(r.band).toBe('modérée')
    expect(r.recommendedRestHours).toBe(24)
  })

  it('une charge très élevée déclenche la bande intense', async () => {
    await seed([{ ...activityAt(0, 12, 120, 12), loggedAt: Date.now() - 60_000 }]) // 10 × 120 = 1200
    expect((await computeDailyRecovery(AGE)).band).toBe('intense')
  })
})

describe('série de jours actifs', () => {
  it('compte les jours consécutifs jusqu’à aujourd’hui', async () => {
    await seed([activityAt(0, 8, 30, 5), activityAt(1, 12, 30, 5), activityAt(2, 18, 30, 5)])
    const s = await computeActivityStreak(AGE)
    expect(s.activeDaysStreak).toBe(3)
    expect(s.restDaysStreak).toBe(0)
  })

  it('un jour sans effort casse la série', async () => {
    await seed([activityAt(0, 8, 30, 5), activityAt(2, 12, 30, 5)])
    expect((await computeActivityStreak(AGE)).activeDaysStreak).toBe(1)
  })

  it('compte les jours de repos quand aujourd’hui est vide', async () => {
    await seed([activityAt(3, 12, 30, 5)])
    const s = await computeActivityStreak(AGE)
    expect(s.activeDaysStreak).toBe(0)
    expect(s.restDaysStreak).toBe(3)
  })
})

describe('ACWR (charge aiguë / chronique)', () => {
  it('charge stable sur 28 jours = ratio 1, zone optimale', async () => {
    await seed(Array.from({ length: 28 }, (_, i) => activityAt(i, 12, 60, 6)))
    const a = await computeAcwr(AGE)
    expect(a.ratio).toBe(1)
    expect(a.risk).toBe('optimal')
  })

  it('un pic sur 7 jours passe en risque élevé', async () => {
    const stable = Array.from({ length: 28 }, (_, i) => activityAt(i, 12, 60, 6))
    const spike = Array.from({ length: 7 }, (_, i) => activityAt(i, 18, 60, 6)) // double charge sur la dernière semaine
    await seed([...stable, ...spike])
    const a = await computeAcwr(AGE)
    expect(a.ratio).toBeGreaterThan(1.5)
    expect(a.risk).toBe('risque élevé')
  })

  it('masque le ratio quand l’historique est trop faible', async () => {
    await seed([activityAt(0, 12, 10, 3)])
    expect((await computeAcwr(AGE)).ratio).toBeNull()
  })
})
