import { describe, expect, it } from 'vitest'
import { compatibleTypes, dedupeSessions, isSameWorkout, mergeSessions } from './enduranceMerge'
import type { EnduranceSession } from '../types'

const at = (iso: string) => new Date(iso).getTime()

function s(partial: Partial<EnduranceSession> & Pick<EnduranceSession, 'id'>): EnduranceSession {
  return { activityType: 'rameur', startedAt: at('2026-09-04T19:28:00'), durationMin: 60, caloriesBurned: 300, ...partial }
}

describe('doublons de séances', () => {
  it('même externalId importé deux fois = une seule séance', () => {
    const a = s({ id: 'a', externalId: 'healthkit-X', caloriesBurned: 403 })
    const b = s({ id: 'b', externalId: 'healthkit-X', caloriesBurned: 513 })
    const r = dedupeSessions([a, b])
    expect(r.removedIds).toHaveLength(1)
  })

  it('cas réel 04/09 : import Apple Health + scan photo 1h30 plus tard + doublon d’import → 1 séance', () => {
    const imp1 = s({ id: 'ccb8', externalId: 'healthkit-661', startedAt: at('2026-09-04T19:28:18'), durationMin: 62, caloriesBurned: 362, avgHeartRate: 107 })
    const imp2 = s({ id: '50ae', externalId: 'healthkit-661', startedAt: at('2026-09-04T19:28:18'), durationMin: 62, caloriesBurned: 362, avgHeartRate: 107 })
    const scan = s({ id: '8d88', startedAt: at('2026-09-04T20:55:38'), durationMin: 60, caloriesBurned: 491, avgHeartRate: 107, photoDataUrl: 'data:x', machineStats: { machineType: 'rower' } })
    const r = dedupeSessions([imp1, imp2, scan])
    expect(r.removedIds.sort()).toEqual(['50ae', 'ccb8'])
    const kept = r.updated[0]
    expect(kept.id).toBe('8d88')
    expect(kept.photoDataUrl).toBe('data:x')
    expect(kept.externalId).toBe('healthkit-661') // ne sera plus réimportée
    expect(kept.startedAt).toBe(at('2026-09-04T19:28:18')) // heure réelle de la montre
    expect(kept.caloriesBurned).toBe(491) // un seul total, pas 362 + 491
  })

  it('cas réel 01/10 : course puis marche sur tapis, enchaînées → deux séances distinctes', () => {
    const run = s({ id: 'run', activityType: 'course', externalId: 'hk-1', startedAt: at('2026-10-01T19:18:46'), durationMin: 20 })
    const walk = s({ id: 'walk', activityType: 'marche', externalId: 'hk-2', startedAt: at('2026-10-01T19:39:10'), durationMin: 25 })
    expect(dedupeSessions([run, walk]).removedIds).toEqual([])
  })

  it('deux vélos importés enchaînés ne fusionnent pas', () => {
    const a = s({ id: 'a', activityType: 'velo', externalId: 'hk-a', startedAt: at('2026-09-29T19:03:00'), durationMin: 8 })
    const b = s({ id: 'b', activityType: 'velo', externalId: 'hk-b', startedAt: at('2026-09-29T19:11:00'), durationMin: 38 })
    expect(dedupeSessions([a, b]).removedIds).toEqual([])
  })

  it('marche du matin et du soir saisies à la main restent deux sorties', () => {
    const am = s({ id: 'am', activityType: 'marche', startedAt: at('2026-10-02T08:00:00'), durationMin: 30 })
    const pm = s({ id: 'pm', activityType: 'marche', startedAt: at('2026-10-02T19:00:00'), durationMin: 30 })
    expect(isSameWorkout(am, pm)).toBe(false)
  })

  it('une saisie manuelle AVANT la séance importée n’est pas fusionnée', () => {
    const imp = s({ id: 'imp', activityType: 'marche', externalId: 'hk', startedAt: at('2026-10-02T18:00:00'), durationMin: 40 })
    const manual = s({ id: 'man', activityType: 'marche', startedAt: at('2026-10-02T09:00:00'), durationMin: 40 })
    expect(isSameWorkout(imp, manual)).toBe(false)
  })

  it('les marches auto (pas du jour) ne sont jamais fusionnées', () => {
    const steps = s({ id: 'steps-2026-10-02', activityType: 'marche', externalId: 'steps-2026-10-02', durationMin: 40 })
    const walk = s({ id: 'w', activityType: 'marche', externalId: 'hk', durationMin: 40 })
    expect(isSameWorkout(steps, walk)).toBe(false)
  })

  it('tapis ↔ course/marche et vélo ↔ vélo d’appartement sont compatibles, pas rameur ↔ vélo', () => {
    expect(compatibleTypes('tapis', 'course')).toBe(true)
    expect(compatibleTypes('velo', 'velo-appart')).toBe(true)
    expect(compatibleTypes('rameur', 'velo')).toBe(false)
    expect(compatibleTypes('course', 'marche')).toBe(false)
  })

  it('la fusion garde les infos présentes d’un seul côté', () => {
    const keep = s({ id: 'k', photoDataUrl: 'p', machineStats: { machineType: 'rower', avgWatts: 120, peakWatts: undefined } })
    const other = s({ id: 'o', externalId: 'hk', distanceKm: 6.2, avgHeartRate: 110, machineStats: { machineType: 'other', peakWatts: 180 } })
    const m = mergeSessions(keep, other)
    expect(m.distanceKm).toBe(6.2)
    expect(m.avgHeartRate).toBe(110)
    expect(m.machineStats).toEqual({ machineType: 'rower', avgWatts: 120, peakWatts: 180 })
    expect(m.notes).toContain('Fusionnée')
  })

  it('idempotent : relancer sur le résultat ne change plus rien', () => {
    const imp = s({ id: 'imp', externalId: 'hk', startedAt: at('2026-09-22T19:31:11'), durationMin: 48 })
    const scan = s({ id: 'scan', startedAt: at('2026-09-22T23:28:37'), durationMin: 45, photoDataUrl: 'p' })
    const first = dedupeSessions([imp, scan])
    const second = dedupeSessions(first.updated)
    expect(second.removedIds).toEqual([])
    expect(second.updated).toEqual([])
  })
})
