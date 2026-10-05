// Détection et fusion des doublons de séances d'endurance.
//
// Une même séance arrive souvent par plusieurs chemins : importée d'Apple
// Santé/Google Fit (via NutriTracker), ET saisie ou scannée à la main dans
// Fit2Be — parfois même importée deux fois quand deux imports tournent en
// parallèle. Vérifié en prod le 2026-10-05 : trois séances Apple Health en
// double (même externalId, ids locaux différents) et deux rameurs comptés deux
// fois (import + scan photo du même entraînement, calories additionnées).

import { dayKey } from './date'
import type { EnduranceActivityType, EnduranceSession, MachineStats } from '../types'

const MIN = 60_000

export function isSynthetic(s: Pick<EnduranceSession, 'id'>): boolean {
  return s.id.startsWith('steps-')
}

export function isImported(s: Pick<EnduranceSession, 'id' | 'externalId'>): boolean {
  return !!s.externalId && !isSynthetic(s)
}

/** Types qui peuvent désigner la même séance selon la source (Apple Santé classe
 * un tapis en "Marche"/"Course", une montre classe un vélo d'appartement en "Vélo"). */
export function compatibleTypes(a: EnduranceActivityType, b: EnduranceActivityType): boolean {
  if (a === b) return true
  const pair = new Set([a, b])
  if (pair.has('tapis') && (pair.has('course') || pair.has('marche'))) return true
  if (pair.has('velo') && pair.has('velo-appart')) return true
  return false
}

export function similarDuration(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(10, 0.25 * Math.max(a, b))
}

function overlapRatio(a: EnduranceSession, b: EnduranceSession): number {
  const aEnd = a.startedAt + a.durationMin * MIN
  const bEnd = b.startedAt + b.durationMin * MIN
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(a.startedAt, b.startedAt))
  const shortest = Math.min(a.durationMin, b.durationMin) * MIN
  return shortest > 0 ? overlap / shortest : 0
}

/** Deux enregistrements décrivent-ils le même entraînement ? */
export function isSameWorkout(a: EnduranceSession, b: EnduranceSession): boolean {
  if (a.id === b.id || isSynthetic(a) || isSynthetic(b)) return false
  if (a.externalId && a.externalId === b.externalId) return true
  if (!compatibleTypes(a.activityType, b.activityType)) return false
  if (!similarDuration(a.durationMin, b.durationMin)) return false

  const aImp = isImported(a)
  const bImp = isImported(b)
  // Deux sources automatiques : leurs horodatages sont fiables, il faut un vrai chevauchement.
  if (aImp && bImp) return overlapRatio(a, b) >= 0.5
  // Deux saisies manuelles : doublon seulement si enregistrées à moins de 30 min d'écart
  // (sinon ce sont deux sorties distinctes du même jour, ex. marche matin et soir).
  if (!aImp && !bImp) return !(a.photoDataUrl && b.photoDataUrl) && Math.abs(a.startedAt - b.startedAt) <= 30 * MIN
  // Import + saisie manuelle : l'heure manuelle est celle de l'enregistrement (souvent
  // après la séance, parfois des heures plus tard pour un scan photo) — on accepte
  // donc une saisie entre 15 min avant le début et 6 h après la fin de la séance importée.
  const imported = aImp ? a : b
  const manual = aImp ? b : a
  if (dayKey(imported.startedAt) !== dayKey(manual.startedAt)) return false
  const importedEnd = imported.startedAt + imported.durationMin * MIN
  return manual.startedAt >= imported.startedAt - 15 * MIN && manual.startedAt <= importedEnd + 6 * 60 * MIN
}

/** Plus c'est haut, plus l'enregistrement porte d'informations saisies/mesurées. */
export function richness(s: EnduranceSession): number {
  let score = 0
  if (s.photoDataUrl) score += 4
  if (s.machineStats && s.machineStats.machineType !== 'other') score += 3
  if (s.healthCapture) score += 2
  if (s.route && s.route.length > 1) score += 2
  if (s.phaseLog && s.phaseLog.length > 0) score += 2
  if (s.rpe != null) score += 1
  if (s.avgHeartRate != null) score += 1
  if (s.distanceKm != null) score += 1
  return score
}

function mergeMachineStats(keep?: MachineStats, other?: MachineStats): MachineStats | undefined {
  if (!keep) return other
  if (!other) return keep
  const merged: MachineStats = { ...other }
  for (const [k, v] of Object.entries(keep)) {
    if (v != null) (merged as unknown as Record<string, unknown>)[k] = v
  }
  merged.machineType = keep.machineType !== 'other' ? keep.machineType : other.machineType
  return merged
}

/** Fusionne `other` dans `keep` (le plus riche) sans jamais perdre une info présente d'un seul côté. */
export function mergeSessions(keep: EnduranceSession, other: EnduranceSession): EnduranceSession {
  const imported = isImported(keep) ? keep : isImported(other) ? other : null
  const merged: EnduranceSession = {
    ...keep,
    // L'heure d'une montre est l'heure réelle de début ; celle d'une saisie, l'heure d'enregistrement.
    startedAt: imported ? imported.startedAt : Math.min(keep.startedAt, other.startedAt),
    externalId: keep.externalId ?? other.externalId,
    source: keep.source ?? other.source,
    distanceKm: keep.distanceKm ?? other.distanceKm,
    avgHeartRate: keep.avgHeartRate ?? other.avgHeartRate,
    hrZone: keep.hrZone ?? other.hrZone,
    machineStats: mergeMachineStats(keep.machineStats, other.machineStats),
    photoDataUrl: keep.photoDataUrl ?? other.photoDataUrl,
    healthCapture: keep.healthCapture ?? other.healthCapture,
    route: keep.route && keep.route.length > 1 ? keep.route : other.route,
    rpe: keep.rpe ?? other.rpe,
    programId: keep.programId ?? other.programId,
    phaseLog: keep.phaseLog && keep.phaseLog.length > 0 ? keep.phaseLog : other.phaseLog,
  }
  if (imported && imported !== keep && !keep.notes?.includes('Fusionnée')) {
    merged.notes = [keep.notes, 'Fusionnée avec la séance importée (montre/téléphone) : un seul enregistrement, calories comptées une fois.']
      .filter(Boolean)
      .join(' ')
  }
  // Ne garde pas de clés explicitement undefined (évite d'écraser à la synchro).
  for (const k of Object.keys(merged) as (keyof EnduranceSession)[]) {
    if (merged[k] === undefined) delete merged[k]
  }
  return merged
}

export interface DedupeResult {
  /** Enregistrements conservés dont le contenu a changé (à réécrire). */
  updated: EnduranceSession[]
  /** Ids des doublons absorbés (à supprimer). */
  removedIds: string[]
  /** Pour chaque doublon supprimé, l'id de la séance qui l'a absorbé. */
  absorbedInto: Record<string, string>
}

/** Regroupe les doublons : le plus riche absorbe les autres. Idempotent. */
export function dedupeSessions(sessions: EnduranceSession[]): DedupeResult {
  const candidates = sessions.filter((s) => !isSynthetic(s))
  // Le plus riche d'abord, puis le plus ancien (stable d'un appareil à l'autre).
  const ordered = [...candidates].sort((a, b) => richness(b) - richness(a) || a.id.localeCompare(b.id))
  const consumed = new Set<string>()
  const updated: EnduranceSession[] = []
  const removedIds: string[] = []
  const absorbedInto: Record<string, string> = {}

  for (const base of ordered) {
    if (consumed.has(base.id)) continue
    let merged = base
    for (const other of ordered) {
      if (other.id === base.id || consumed.has(other.id)) continue
      if (!isSameWorkout(merged, other)) continue
      merged = mergeSessions(merged, other)
      consumed.add(other.id)
      removedIds.push(other.id)
      absorbedInto[other.id] = base.id
    }
    if (merged !== base) updated.push(merged)
  }
  return { updated, removedIds, absorbedInto }
}
