// Check-in du jour : un seul enregistrement par jour (store "recovery"), partagé
// entre l'Accueil et la page Récup. Avant, la fatigue musculaire était demandée
// deux fois (curseurs 1-5 de l'Accueil + check-in 1-10 de Récup), avec deux
// stores différents et un bouton "Valider" en plus.

import { getDb, newId } from './db'
import { pushRecord, deleteRecord } from './cloudSync'
import { getFatigue } from './fatigue'
import { getGoogleFitForDate } from './googleFit'
import { computeDailyRecovery } from './recovery'
import type { Settings } from './settings'
import type { RecoveryCheckin } from '../types'

/** Du meilleur au pire, dans la palette de l'app (bleu → indigo → orange → écarlate). */
const SCALE = ['#4a63d8', '#7b6be6', '#ff9466', '#ff5a30', '#e2361c']

/** t = 0 (bon) … 1 (mauvais) → couleur du palier. */
export function levelColor(t: number): string {
  return SCALE[Math.max(0, Math.min(SCALE.length - 1, Math.round(t * (SCALE.length - 1))))]
}

export interface Level {
  upTo: number
  label: string
  hint: string
}

export function levelFor(levels: Level[], value: number): Level {
  return levels.find((l) => value <= l.upTo) ?? levels[levels.length - 1]
}

export const GENERAL_FATIGUE_LEVELS: Level[] = [
  { upTo: 2, label: 'Aucune', hint: "Plein d'énergie, rien ne tire." },
  { upTo: 4, label: 'Légère', hint: "Un peu de lourdeur, ça n'empêche rien." },
  { upTo: 6, label: 'Modérée', hint: 'Ça se sent : séance normale, sans forcer.' },
  { upTo: 8, label: 'Élevée', hint: 'Corps lourd : préfère une séance légère ou de la récup.' },
  { upTo: 10, label: 'Épuisement', hint: "Repos ou récup active aujourd'hui." },
]

export const MUSCLE_FATIGUE_LEVELS: Level[] = [
  { upTo: 2, label: 'Aucune', hint: 'Muscles frais, aucune courbature.' },
  { upTo: 4, label: 'Légère', hint: "Petites raideurs : l'échauffement suffit." },
  { upTo: 6, label: 'Modérée', hint: 'Courbatures nettes : évite de retravailler les mêmes muscles.' },
  { upTo: 8, label: 'Élevée', hint: "Douleur au mouvement : entraîne d'autres groupes." },
  { upTo: 10, label: 'Épuisement', hint: 'Muscles à plat : repos complet.' },
]

export const MOTIVATION_LEVELS: Level[] = [
  { upTo: 1, label: 'Nulle', hint: "Aucune envie aujourd'hui — une marche suffit." },
  { upTo: 2, label: 'Faible', hint: 'Il faudra se pousser un peu.' },
  { upTo: 3, label: 'Correcte', hint: 'Partant pour une séance normale.' },
  { upTo: 4, label: 'Bonne', hint: 'Envie de bouger.' },
  { upTo: 5, label: 'À fond', hint: 'Prêt à tout donner.' },
]

export function sleepLevel(hours: number, targetMin: number): Level {
  const ratio = (hours * 60) / targetMin
  if (hours < 5) return { upTo: 0, label: 'Très courte', hint: 'Nuit très courte : vas-y en douceur.' }
  if (ratio < 0.85) return { upTo: 0, label: 'Courte', hint: 'Un peu de dette de sommeil.' }
  if (ratio < 1.15) return { upTo: 0, label: 'Bonne', hint: 'Dans ton objectif de sommeil.' }
  return { upTo: 0, label: 'Longue', hint: 'Bien au-dessus de ton objectif.' }
}

export interface CheckinDraft {
  sleepHours: number
  sleepSource: 'googlefit' | 'manual' | 'none'
  generalFatigue: number
  muscleFatigue: number
  motivation: number
}

const clamp5 = (n: number) => Math.max(1, Math.min(5, Math.round(n)))

/** Ressenti du jour sur 100 : sommeil, motivation, fatigue générale et musculaire (inversées). */
export function computeSubjectiveScore(
  c: { sleepHours?: number | null; generalFatigue?: number | null; muscleFatigue: number; motivation: number },
  sleepTargetMin: number,
): number {
  const parts = [
    c.sleepHours != null ? clamp5(((c.sleepHours * 60) / sleepTargetMin) * 5) : 3,
    clamp5(c.motivation),
    clamp5((11 - c.muscleFatigue) / 2),
    ...(c.generalFatigue != null ? [clamp5((11 - c.generalFatigue) / 2)] : []),
  ]
  return Math.round((parts.reduce((s, n) => s + n, 0) / (parts.length * 5)) * 100)
}

export function isHighFatigueCheckin(c: Pick<RecoveryCheckin, 'generalFatigue' | 'muscleFatigue'> | null | undefined): boolean {
  return !!c && ((c.generalFatigue ?? 0) >= 7 || c.muscleFatigue >= 7)
}

export async function getCheckin(date: string): Promise<RecoveryCheckin | null> {
  const rows = await (await getDb()).getAllFromIndex('recovery', 'byDate', date)
  return rows[0] ?? null
}

/** Valeurs de départ : le check-in déjà fait, sinon le sommeil Google Fit et les
 * anciens curseurs de fatigue de l'Accueil (échelle 1-5 → 1-10). */
export async function loadCheckinDraft(date: string): Promise<{ draft: CheckinDraft; saved: RecoveryCheckin | null }> {
  const saved = await getCheckin(date)
  if (saved) {
    return {
      saved,
      draft: {
        sleepHours: saved.sleepHours ?? 7,
        sleepSource: saved.sleepSource ?? (saved.sleepHours != null ? 'manual' : 'none'),
        generalFatigue: saved.generalFatigue ?? 5,
        muscleFatigue: saved.muscleFatigue,
        motivation: saved.motivation,
      },
    }
  }
  const [gf, legacy] = await Promise.all([getGoogleFitForDate(date), getFatigue(date)])
  return {
    saved: null,
    draft: {
      sleepHours: gf?.sleepMinutes != null ? Math.round((gf.sleepMinutes / 60) * 4) / 4 : 7,
      sleepSource: gf?.sleepMinutes != null ? 'googlefit' : 'none',
      generalFatigue: legacy ? legacy.general * 2 : 5,
      muscleFatigue: legacy ? legacy.muscular * 2 : 5,
      motivation: 3,
    },
  }
}

/** Enregistre le check-in du jour (un seul par jour), score Body Battery recalculé avec la charge du jour. */
export async function saveCheckin(date: string, draft: CheckinDraft, settings: Settings): Promise<RecoveryCheckin> {
  const db = await getDb()
  const existing = await db.getAllFromIndex('recovery', 'byDate', date)
  const keep = existing[0]
  for (const extra of existing.slice(1)) {
    await db.delete('recovery', extra.id)
    deleteRecord('recovery', extra.id)
  }
  const penalty = (await computeDailyRecovery(settings.ageYears)).bodyBatteryPenalty
  const subjective = computeSubjectiveScore(draft, settings.sleepTargetMin)
  const checkin: RecoveryCheckin = {
    ...(keep ?? {}),
    id: keep?.id ?? newId(),
    date,
    sleepHours: draft.sleepHours,
    ...(draft.sleepSource !== 'none' ? { sleepSource: draft.sleepSource } : {}),
    generalFatigue: draft.generalFatigue,
    muscleFatigue: draft.muscleFatigue,
    motivation: draft.motivation as RecoveryCheckin['motivation'],
    bodyBatteryScore: Math.max(0, subjective - penalty),
  }
  await db.put('recovery', checkin)
  pushRecord('recovery', checkin.id, checkin)
  return checkin
}
