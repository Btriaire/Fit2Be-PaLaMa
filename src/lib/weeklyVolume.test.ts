import { describe, expect, it } from 'vitest'
import { mostNeglected, volumeStatus, weeklyVolumeByGroup } from './weeklyVolume'

describe('repères de volume hebdomadaire', () => {
  it('classe les séries par semaine', () => {
    expect(volumeStatus(0)).toBe('none')
    expect(volumeStatus(4)).toBe('low')
    expect(volumeStatus(8)).toBe('near')
    expect(volumeStatus(10)).toBe('ok')
    expect(volumeStatus(20)).toBe('ok')
    expect(volumeStatus(21)).toBe('high')
  })

  it('regroupe Dos / Milieu du dos / Bas du dos et inclut les groupes à zéro', () => {
    const v = weeklyVolumeByGroup([
      { muscleGroup: 'Dos', totalSets: 6, totalVolume: 0 },
      { muscleGroup: 'Milieu du dos', totalSets: 5, totalVolume: 0 },
      { muscleGroup: 'Pectoraux', totalSets: 12, totalVolume: 0 },
    ])
    expect(v.find((g) => g.label === 'Dos')).toMatchObject({ sets: 11, status: 'ok' })
    expect(v.find((g) => g.label === 'Pectoraux')?.status).toBe('ok')
    expect(v.find((g) => g.label === 'Mollets')).toMatchObject({ sets: 0, status: 'none' })
    expect(v).toHaveLength(10)
  })

  it('désigne les groupes les plus en retard', () => {
    const v = weeklyVolumeByGroup([
      { muscleGroup: 'Pectoraux', totalSets: 14, totalVolume: 0 },
      { muscleGroup: 'Épaules', totalSets: 3, totalVolume: 0 },
    ])
    const names = mostNeglected(v, 3).map((g) => g.label)
    expect(names).not.toContain('Pectoraux')
    expect(names).toHaveLength(3)
    expect(mostNeglected(v, 3).every((g) => g.sets < 10)).toBe(true)
  })
})
