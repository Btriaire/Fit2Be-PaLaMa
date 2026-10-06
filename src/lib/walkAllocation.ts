// Catégoriser a posteriori les marches de la vie courante : une partie des pas
// d'une journée (ou d'une marche détectée par la montre) était en fait des
// courses, du jardinage, du ménage… On la réattribue à ces activités, en tout
// ou en partie (ex. 50 % courses / 50 % jardinage) ; le reste reste de la marche.
//
// Chaque part devient une ActivityLog marquée `fromWalkId`. Pour la marche
// auto "pas du quotidien" (steps-AAAA-MM-JJ), ces activités sont déduites au
// recalcul (stepsActivity.ts) ; pour une vraie sortie marche, sa durée et ses
// calories sont réduites d'autant. Recatégoriser remplace la répartition
// précédente — rien n'est perdu ni compté deux fois.

import { getDb, newId } from './db'
import { pushRecord, deleteRecord } from './cloudSync'
import { bmrShareForDuration, computeCaloriesForUser } from './met'
import { isSynthetic } from './enduranceMerge'
import type { Settings } from './settings'
import type { ActivityCategory, ActivityLog, EnduranceSession } from '../types'

export interface WalkCategory {
  id: string
  label: string
  /** Libellé de l'activité créée (aligné sur MET_ACTIVITIES quand elle existe). */
  activityLabel: string
  met: number
  category: ActivityCategory
}

/** "Journée normale" = la part qui reste de la marche (pas d'activité créée). */
export const NORMAL_DAY_ID = 'normal'

export const WALK_CATEGORIES: WalkCategory[] = [
  { id: 'shopping', label: 'Courses / shopping', activityLabel: 'Courses (magasins)', met: 2.3, category: 'quotidien' },
  { id: 'jardinage', label: 'Jardinage', activityLabel: 'Jardinage', met: 4, category: 'quotidien' },
  { id: 'menage', label: 'Ménage', activityLabel: 'Ménage', met: 3.3, category: 'quotidien' },
  { id: 'bricolage', label: 'Bricolage', activityLabel: 'Bricolage', met: 4.5, category: 'quotidien' },
  { id: 'porter', label: 'Porter des charges', activityLabel: 'Porter les courses', met: 4, category: 'quotidien' },
  { id: 'promenade', label: 'Promenade / balade', activityLabel: 'Promenade', met: 3, category: 'loisir' },
  { id: 'enfants', label: 'Avec les enfants', activityLabel: 'Jouer avec les enfants', met: 3, category: 'loisir' },
  { id: 'travail', label: 'Au travail', activityLabel: 'Marche au travail', met: 3.3, category: 'bureau' },
  { id: 'trajets', label: 'Trajets / transports', activityLabel: 'Trajets à pied', met: 3.5, category: 'deplacement' },
]

export type WalkShares = Record<string, number> // id de catégorie → pourcentage (0-100)

/** Minutes par catégorie à partir des pourcentages ; la journée normale prend le reste. */
export function computeAllocation(baseMin: number, shares: WalkShares): { minutesById: Record<string, number>; normalMin: number } {
  const minutesById: Record<string, number> = {}
  let allocated = 0
  for (const c of WALK_CATEGORIES) {
    const pct = Math.max(0, Math.min(100, shares[c.id] ?? 0))
    if (pct <= 0) continue
    const min = Math.round((baseMin * pct) / 100)
    if (min <= 0) continue
    minutesById[c.id] = min
    allocated += min
  }
  // Arrondis : on ne dépasse jamais la durée de départ.
  if (allocated > baseMin) {
    const last = Object.keys(minutesById).pop()
    if (last) minutesById[last] -= allocated - baseMin
    allocated = baseMin
  }
  return { minutesById, normalMin: baseMin - allocated }
}

/** Répartit équitablement entre les catégories choisies (2 → 50/50, 3 → 34/33/33). */
export function evenShares(ids: string[]): WalkShares {
  const shares: WalkShares = {}
  if (ids.length === 0) return shares
  const base = Math.floor(100 / ids.length)
  ids.forEach((id, i) => (shares[id] = base + (i < 100 - base * ids.length ? 1 : 0)))
  return shares
}

export function allocationLogsFor(walkId: string, logs: ActivityLog[]): ActivityLog[] {
  return logs.filter((l) => l.fromWalkId === walkId)
}

/** La marche est-elle encore à catégoriser ? (marche de la vie courante, pas encore précisée) */
export function needsCategorizing(s: EnduranceSession, logs: ActivityLog[]): boolean {
  if (s.activityType !== 'marche' || s.walkCategorized) return false
  // Une marche saisie à la main est une vraie sortie voulue : on ne la propose pas.
  if (!isSynthetic(s) && !s.externalId) return false
  return allocationLogsFor(s.id, logs).length === 0
}

/** Pourcentages actuels d'une marche déjà catégorisée (pour rouvrir la feuille). */
export function currentShares(s: EnduranceSession, logs: ActivityLog[]): WalkShares {
  const own = allocationLogsFor(s.id, logs)
  const base = s.durationMin + own.reduce((sum, l) => sum + l.durationMin, 0)
  const shares: WalkShares = {}
  if (base <= 0) return shares
  for (const l of own) {
    const cat = WALK_CATEGORIES.find((c) => c.activityLabel === l.label)
    if (cat) shares[cat.id] = (shares[cat.id] ?? 0) + Math.round((l.durationMin / base) * 100)
  }
  return shares
}

/**
 * Applique (ou remplace) la répartition d'une marche. Renvoie le nombre de minutes
 * réattribuées. Les calories des parts sont nettes (sans le métabolisme de repos déjà
 * compté sur la journée), comme celles de la marche qu'elles remplacent.
 */
export async function allocateWalk(walkId: string, shares: WalkShares, settings: Settings): Promise<number> {
  const db = await getDb()
  const walk = await db.get('endurance', walkId)
  if (!walk) throw new Error('Marche introuvable')

  // Annule la répartition précédente : la marche retrouve sa durée/ses calories d'origine.
  const previous = allocationLogsFor(walkId, await db.getAll('activities'))
  const prevMin = previous.reduce((s, l) => s + l.durationMin, 0)
  for (const l of previous) {
    await db.delete('activities', l.id)
    deleteRecord('activities', l.id)
  }
  const synthetic = isSynthetic(walk)
  const baseMin = walk.durationMin + prevMin
  const baseKcal = synthetic ? walk.caloriesBurned : walk.caloriesBurned + (walk.allocatedKcal ?? 0)

  const { minutesById, normalMin } = computeAllocation(baseMin, shares)
  let movedMin = 0
  for (const c of WALK_CATEGORIES) {
    const minutes = minutesById[c.id]
    if (!minutes) continue
    movedMin += minutes
    const log: ActivityLog = {
      id: newId(),
      category: c.category,
      label: c.activityLabel,
      metValue: c.met,
      durationMin: minutes,
      caloriesBurned: Math.max(0, computeCaloriesForUser(c.met, minutes, settings) - bmrShareForDuration(minutes, settings)),
      loggedAt: walk.startedAt,
      source: 'manual',
      fromWalkId: walkId,
    }
    await db.put('activities', log)
    pushRecord('activities', log.id, log)
  }

  if (synthetic) {
    // La marche auto est recalculée depuis les pas (les parts ci-dessus en sont déduites) ;
    // on garde seulement la trace qu'elle a été précisée.
    const next: EnduranceSession = { ...walk, walkCategorized: true }
    await db.put('endurance', next)
    pushRecord('endurance', walkId, next)
  } else {
    const keptKcal = baseMin > 0 ? Math.round(baseKcal * (normalMin / baseMin)) : 0
    const next: EnduranceSession = {
      ...walk,
      durationMin: normalMin,
      caloriesBurned: keptKcal,
      allocatedKcal: baseKcal - keptKcal,
      walkCategorized: true,
    }
    await db.put('endurance', next)
    pushRecord('endurance', walkId, next)
  }
  return movedMin
}

/** Supprime une activité ; si c'était une part de marche, la marche récupère ses minutes et calories. */
export async function deleteActivityLog(id: string): Promise<void> {
  const db = await getDb()
  const log = await db.get('activities', id)
  if (!log) return
  await db.delete('activities', id)
  deleteRecord('activities', id)
  if (!log.fromWalkId) return
  const walk = await db.get('endurance', log.fromWalkId)
  if (!walk) return
  const others = allocationLogsFor(walk.id, await db.getAll('activities'))
  if (isSynthetic(walk)) {
    // La marche auto se recalcule seule depuis les pas ; plus aucune part = à reproposer.
    if (others.length === 0 && walk.walkCategorized) {
      const next = { ...walk, walkCategorized: false }
      await db.put('endurance', next)
      pushRecord('endurance', walk.id, next)
    }
    return
  }
  const allocatedMin = log.durationMin + others.reduce((s, l) => s + l.durationMin, 0)
  const share = walk.allocatedKcal && allocatedMin > 0 ? Math.round(walk.allocatedKcal * (log.durationMin / allocatedMin)) : 0
  const next: EnduranceSession = {
    ...walk,
    durationMin: walk.durationMin + log.durationMin,
    caloriesBurned: walk.caloriesBurned + share,
    allocatedKcal: Math.max(0, (walk.allocatedKcal ?? 0) - share),
    walkCategorized: others.length > 0,
  }
  await db.put('endurance', next)
  pushRecord('endurance', walk.id, next)
}
