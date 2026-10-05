// Point unique de synchronisation montre/téléphone → Fit2Be.
//
// Avant, le démarrage de l'app lançait EN PARALLÈLE l'import des séances
// NutriTracker et le calcul de la marche auto, et le bouton Synchro du Dashboard
// refaisait pareil de son côté : deux imports simultanés lisaient « pas encore
// importé » avant que l'autre n'écrive, d'où des séances Apple Health en double.
// Ici tout passe dans l'ordre, une seule fois à la fois :
//   1. Google Fit (pas, sommeil, FC) via NutriTracker
//   2. import / mise à jour des séances (Apple Santé, Google Fit)
//   3. fusion des doublons (import + saisie/scan de la même séance)
//   4. marche auto = pas du jour hors séances déjà comptées

import { syncGoogleFit } from './googleFit'
import { importNutriTrackerActivityHistory } from './nutriTrackerImport'
import { dedupeEnduranceSessions } from './endurance'
import { processStepsWalks } from './stepsActivity'
import type { Settings } from './settings'

const LAST_REFRESH_KEY = 'fit2be:lastFitRefreshAt'
const LAST_IMPORT_KEY = 'fit2be:lastNutriTrackerAutoImport'
const IMPORT_MIN_INTERVAL_MS = 15 * 60_000

export interface FitRefreshResult {
  imported: number
  merged: number
  at: number
}

let inflight: Promise<FitRefreshResult> | null = null

/** Émis à la fin de chaque synchro : les pages ouvertes se rechargent (sinon l'Accueil
 * gardait l'état d'avant l'import/la fusion jusqu'à la prochaine navigation). */
export const FIT_REFRESHED_EVENT = 'fit2be:fit-refreshed'

/** Abonne une page aux fins de synchro ; renvoie la fonction de désabonnement. */
export function onFitRefreshed(cb: () => void): () => void {
  window.addEventListener(FIT_REFRESHED_EVENT, cb)
  return () => window.removeEventListener(FIT_REFRESHED_EVENT, cb)
}

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

function writeNow(key: string, at: number) {
  try {
    localStorage.setItem(key, String(at))
  } catch {
    // stockage indisponible : on refera l'import la prochaine fois, sans gravité
  }
}

/** Synchro complète, sérialisée. `force` (bouton Synchro) ignore les délais anti-rafale. */
export function refreshFitData(settings: Settings, opts: { force?: boolean } = {}): Promise<FitRefreshResult> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      await syncGoogleFit(14, { force: opts.force })
      let imported = 0
      if (opts.force || Date.now() - readNumber(LAST_IMPORT_KEY) >= IMPORT_MIN_INTERVAL_MS) {
        imported = await importNutriTrackerActivityHistory(30, settings).catch(() => 0)
        writeNow(LAST_IMPORT_KEY, Date.now())
      }
      const { removedIds } = await dedupeEnduranceSessions()
      await processStepsWalks(settings)
      const at = Date.now()
      writeNow(LAST_REFRESH_KEY, at)
      window.dispatchEvent(new Event(FIT_REFRESHED_EVENT))
      return { imported, merged: removedIds.length, at }
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function lastFitRefreshAt(): number | null {
  return readNumber(LAST_REFRESH_KEY) || null
}

export function formatAgo(at: number | null, now = Date.now()): string {
  if (!at) return 'jamais'
  const min = Math.round((now - at) / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`
}
