import type { GoogleFitDay } from '../types'

export interface FitIssue {
  id: 'stale' | 'no-sleep' | 'no-data'
  text: string
}

const HOUR = 3_600_000

/**
 * État de la chaîne Google Fit → NutriTracker → Fit2Be, en clair : chiffres périmés, sommeil
 * qui ne remonte plus. `days` = jours en cache (le plus récent d'abord ou non, on trie).
 */
export function assessFitHealth(days: GoogleFitDay[], now = Date.now()): FitIssue[] {
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date))
  if (sorted.length === 0) return [{ id: 'no-data', text: 'Aucune donnée Google Fit reçue pour le moment.' }]

  const issues: FitIssue[] = []

  const lastRemote = Math.max(0, ...sorted.map((d) => d.remoteSyncedAt ?? 0))
  if (lastRemote > 0 && now - lastRemote > 6 * HOUR) {
    const h = Math.round((now - lastRemote) / HOUR)
    issues.push({
      id: 'stale',
      text: `Google Fit n'a pas transmis de données depuis ${h >= 48 ? `${Math.round(h / 24)} j` : `${h} h`}. Ouvre l'appli Google Fit sur ton téléphone pour la réveiller.`,
    })
  }

  // Sommeil : on regarde en arrière depuis hier (aujourd'hui n'est pas encore complet le matin).
  const withoutToday = sorted.slice(1)
  let missing = 0
  for (const d of withoutToday) {
    if (d.sleepMinutes != null) break
    missing++
  }
  if (missing >= 2) {
    issues.push({
      id: 'no-sleep',
      text: `Le sommeil ne remonte plus depuis ${missing} jours. Vérifie que ta montre ou ton appli l'enregistre dans Google Fit ; en attendant, ton check-in Récup sert de repli.`,
    })
  }
  return issues
}

/** Sommeil du jour en minutes : la source synchronisée, sinon les heures saisies au check-in. */
export function effectiveSleepMinutes(day: Pick<GoogleFitDay, 'sleepMinutes'> | null, checkinSleepHours?: number | null): number | null {
  if (day?.sleepMinutes != null) return day.sleepMinutes
  if (checkinSleepHours != null && checkinSleepHours > 0) return Math.round(checkinSleepHours * 60)
  return null
}
