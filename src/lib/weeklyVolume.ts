import type { MuscleGroupStat } from './workouts'

// Repère : ~10 à 20 séries de travail par muscle et par semaine pour progresser en
// hypertrophie (Schoenfeld, Ogborn & Krieger, J Sports Sci 2017). En dessous de ~6, le
// stimulus est probablement insuffisant ; au-delà de 20, le gain marginal chute.
export const VOLUME_TARGET_MIN = 10
export const VOLUME_TARGET_MAX = 20

export type VolumeStatus = 'none' | 'low' | 'near' | 'ok' | 'high'

export function volumeStatus(sets: number): VolumeStatus {
  if (sets <= 0) return 'none'
  if (sets < 6) return 'low'
  if (sets < VOLUME_TARGET_MIN) return 'near'
  if (sets <= VOLUME_TARGET_MAX) return 'ok'
  return 'high'
}

export const VOLUME_STATUS_LABEL: Record<VolumeStatus, string> = {
  none: 'pas travaillé',
  low: 'trop peu',
  near: 'presque',
  ok: 'zone efficace',
  high: 'beaucoup',
}

/** Groupes suivis, dans l'ordre d'affichage. Certains regroupent des sous-groupes du catalogue. */
export const TRACKED_GROUPS: Array<{ label: string; sources: string[] }> = [
  { label: 'Pectoraux', sources: ['Pectoraux'] },
  { label: 'Dos', sources: ['Dos', 'Milieu du dos', 'Bas du dos'] },
  { label: 'Épaules', sources: ['Épaules'] },
  { label: 'Biceps', sources: ['Biceps'] },
  { label: 'Triceps', sources: ['Triceps'] },
  { label: 'Quadriceps', sources: ['Quadriceps', 'Jambes'] },
  { label: 'Ischio-jambiers', sources: ['Ischio-jambiers'] },
  { label: 'Fessiers', sources: ['Fessiers'] },
  { label: 'Mollets', sources: ['Mollets'] },
  { label: 'Abdominaux', sources: ['Abdominaux'] },
]

export interface GroupVolume {
  label: string
  sets: number
  status: VolumeStatus
}

/** Séries des 7 derniers jours par groupe suivi (zéro inclus pour les groupes non travaillés). */
export function weeklyVolumeByGroup(stats: MuscleGroupStat[]): GroupVolume[] {
  const bySource = new Map(stats.map((s) => [s.muscleGroup, s.totalSets]))
  return TRACKED_GROUPS.map(({ label, sources }) => {
    const sets = sources.reduce((sum, src) => sum + (bySource.get(src) ?? 0), 0)
    return { label, sets, status: volumeStatus(sets) }
  })
}

/** Les groupes les plus en retard (moins de séries), pour orienter la prochaine séance. */
export function mostNeglected(groups: GroupVolume[], n = 2): GroupVolume[] {
  return groups
    .filter((g) => g.sets < VOLUME_TARGET_MIN)
    .sort((a, b) => a.sets - b.sets)
    .slice(0, n)
}
