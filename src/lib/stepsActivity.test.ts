import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROFILE } from '../test/fixtures'
import type { GoogleFitDay } from '../types'

const pushRecord = vi.fn()
const deleteRecord = vi.fn()
let fitDays: GoogleFitDay[] = []

vi.mock('./cloudSync', () => ({ pushRecord: (...a: unknown[]) => pushRecord(...a), deleteRecord: (...a: unknown[]) => deleteRecord(...a) }))
vi.mock('./googleFit', () => ({ syncGoogleFit: async () => {}, getGoogleFitDays: async () => fitDays }))

import { getDb } from './db'
import { autoLogWalkFromStepsIfNeeded } from './stepsActivity'

const DAY = '2026-09-10'
const noon = new Date(`${DAY}T12:00:00`).getTime()

function fitDay(over: Partial<GoogleFitDay> = {}): GoogleFitDay {
  return { date: DAY, steps: 9150, activeCaloriesBurned: 1800, activeMinutes: 60, heartRateAvg: null, sleepMinutes: null, syncedAt: 0, ...over }
}

async function sessions() {
  return (await getDb()).getAll('endurance')
}

beforeEach(async () => {
  const db = await getDb()
  await Promise.all([db.clear('endurance'), db.clear('activities')])
  pushRecord.mockClear()
  deleteRecord.mockClear()
  fitDays = [fitDay()]
})

describe('Marche automatique depuis les pas Google Fit', () => {
  it('crée une séance Marche avec les calories NEAT, pas le total journalier de Google Fit', async () => {
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    const [s] = await sessions()
    expect(s.id).toBe(`steps-${DAY}`)
    expect(s.activityType).toBe('marche')
    expect(s.durationMin).toBe(60)
    expect(s.caloriesBurned).toBe(343) // 9150 pas × 0,0005 × 75 kg — et non 1800
    expect(s.startedAt).toBe(noon)
    expect(s.source).toBe('googlefit')
  })

  it('est idempotente : relancer sans changement ne repousse rien vers le VPS', async () => {
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    expect(await sessions()).toHaveLength(1)
    expect(pushRecord).toHaveBeenCalledTimes(1)
  })

  it('repousse quand les pas changent dans la journée', async () => {
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    fitDays = [fitDay({ steps: 12_000, activeMinutes: 80 })]
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    const [s] = await sessions()
    expect(s.durationMin).toBe(80)
    expect(s.caloriesBurned).toBe(450)
    expect(pushRecord).toHaveBeenCalledTimes(2)
  })

  it('ne crée rien sous le seuil de 3 000 pas, et retire une séance devenue invalide', async () => {
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    expect(await sessions()).toHaveLength(1)
    fitDays = [fitDay({ steps: 2000 })]
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    expect(await sessions()).toHaveLength(0)
    expect(deleteRecord).toHaveBeenCalledWith('endurance', `steps-${DAY}`)
  })

  it('retire de la Marche la durée des activités « quotidien » déjà loguées (pas de double compte)', async () => {
    const db = await getDb()
    await db.put('activities', { id: 'a1', category: 'quotidien', label: 'Jardinage', metValue: 4, durationMin: 20, caloriesBurned: 100, loggedAt: noon })
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    const [s] = await sessions()
    expect(s.durationMin).toBe(40)
    expect(s.caloriesBurned).toBe(229) // 343 × 40/60
    expect(s.notes).toContain('20 min')
  })

  it('déduit une vraie marche importée mais garde le reste des pas du jour', async () => {
    const db = await getDb()
    await db.put('endurance', { id: 'real-1', activityType: 'marche', startedAt: noon - 3600_000, durationMin: 45, caloriesBurned: 200, externalId: 'healthkit-abc' })
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    const synthetic = (await sessions()).find((s) => s.id === `steps-${DAY}`)
    expect(synthetic?.durationMin).toBe(15) // 60 min actives − 45 min déjà comptées
    expect(synthetic?.caloriesBurned).toBe(86) // 343 × 15/60
    expect(synthetic?.notes).toContain('45 min de sorties enregistrées')
  })

  it('déduit aussi une course (ses pas sont dans le compteur), pas un vélo', async () => {
    const db = await getDb()
    await db.put('endurance', { id: 'run', activityType: 'course', startedAt: noon, durationMin: 20, caloriesBurned: 250 })
    await db.put('endurance', { id: 'bike', activityType: 'velo', startedAt: noon, durationMin: 30, caloriesBurned: 250 })
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    const synthetic = (await sessions()).find((s) => s.id === `steps-${DAY}`)
    expect(synthetic?.durationMin).toBe(40)
  })

  it('ne garde rien quand les sorties couvrent presque toute l’activité du jour', async () => {
    const db = await getDb()
    await db.put('endurance', { id: 'real-1', activityType: 'marche', startedAt: noon, durationMin: 55, caloriesBurned: 200, externalId: 'healthkit-abc' })
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    expect((await sessions()).map((s) => s.id)).toEqual(['real-1'])
  })

  it('rattrape aussi les jours passés, pas seulement aujourd’hui', async () => {
    fitDays = [fitDay({ date: '2026-09-08' }), fitDay({ date: '2026-09-09', steps: 7000, activeMinutes: 50 }), fitDay()]
    await autoLogWalkFromStepsIfNeeded(PROFILE)
    expect((await sessions()).map((s) => s.id).sort()).toEqual(['steps-2026-09-08', 'steps-2026-09-09', 'steps-2026-09-10'])
  })
})
