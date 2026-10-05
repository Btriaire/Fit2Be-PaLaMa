// Log automatiquement une "Marche" dans l'historique dès que le nombre de pas
// du jour dépasse un seuil significatif — même si NutriTracker n'a pas encore
// remonté cette séance comme activité explicite (le flux d'activités
// NutriTracker/Google Fit a parfois plusieurs heures de retard, alors que le
// compteur de pas est disponible immédiatement). Ça évite qu'une journée
// avec beaucoup de marche compte pour "aucune activité" en Récupération.

import { getDb } from './db'
import { syncGoogleFit, getGoogleFitDays } from './googleFit'
import { pushRecord, deleteRecord } from './cloudSync'
import { computeCaloriesFromSteps } from './met'
import type { Settings } from './settings'
import type { EnduranceActivityType, EnduranceSession, GoogleFitDay } from '../types'

const STEPS_THRESHOLD = 3000
const BACKFILL_DAYS = 14

/** Sorties faites à pied : leurs pas sont déjà dans le compteur du jour. */
const ON_FOOT_TYPES = new Set<EnduranceActivityType>(['marche', 'course', 'tapis'])
/** Activités loguées dans "Activités" qui sont de la marche (hors catégorie quotidien). */
const WALKING_ACTIVITY_LABELS = new Set(['Marche rapide', 'Randonnée', 'Réunion en marchant'])

function syntheticId(date: string) {
  return `steps-${date}`
}

async function processDay(day: GoogleFitDay, settings: Settings): Promise<void> {
  const db = await getDb()
  const id = syntheticId(day.date)
  const dayStart = new Date(`${day.date}T00:00:00`).getTime()
  const dayEnd = dayStart + 24 * 3600_000
  const existing = await db.getAllFromIndex('endurance', 'byStartedAt', IDBKeyRange.bound(dayStart, dayEnd))

  async function removeSyntheticIfPresent() {
    if (existing.some((s) => s.id === id)) {
      await db.delete('endurance', id)
      deleteRecord('endurance', id)
    }
  }

  if (day.steps < STEPS_THRESHOLD) {
    await removeSyntheticIfPresent()
    return
  }

  const rawDurationMin = day.activeMinutes > 0 ? day.activeMinutes : Math.round(day.steps / 100)
  // Ne PAS utiliser day.activeCaloriesBurned ici : ce champ vient de
  // com.google.calories.expended côté Google Fit, qui inclut le métabolisme
  // de base de toute la journée malgré son nom — vérifié en prod le
  // 2026-09-18, des Marche auto-générées de 130-230 min affichaient
  // 1780-1930 kcal (quasi tout le TDEE du jour), alors que les jours importés
  // d'Apple Health (calories réellement actives) tournaient à 600-800 kcal
  // pour des durées comparables. On utilise toujours notre propre formule
  // NEAT (pas × poids), qui ne compte que la dépense en plus du repos.
  const rawCalories = computeCaloriesFromSteps(day.steps, settings)

  // Le total de pas du jour inclut aussi ceux des sorties enregistrées à part
  // (marche, course, tapis — importées de la montre ou saisies) et des activités
  // du quotidien loguées (jardinage, courses...). On les retire pour que cette
  // entrée ne garde que le mouvement "restant" de la journée : avant, une seule
  // vraie marche importée faisait disparaître tous les autres pas du jour, et
  // une course n'était pas déduite du tout (ses pas comptaient deux fois).
  const dayActivities = await db.getAllFromIndex('activities', 'byLoggedAt', IDBKeyRange.bound(dayStart, dayEnd))
  const activityMin = dayActivities.filter((a) => a.category === 'quotidien' || WALKING_ACTIVITY_LABELS.has(a.label)).reduce((s, a) => s + a.durationMin, 0)
  const onFootMin = existing.filter((s) => s.id !== id && ON_FOOT_TYPES.has(s.activityType)).reduce((s, e) => s + e.durationMin, 0)
  const overlapMin = activityMin + onFootMin
  const durationMin = Math.max(0, rawDurationMin - overlapMin)

  // En dessous de 10 min restantes, ce n'est plus que du bruit de fond.
  if (durationMin < 10) {
    await removeSyntheticIfPresent()
    return
  }

  const caloriesBurned = Math.round(rawCalories * (durationMin / rawDurationMin))
  const deducted = [
    onFootMin > 0 ? `${onFootMin} min de sorties enregistrées` : null,
    activityMin > 0 ? `${activityMin} min d'activités du quotidien` : null,
  ].filter(Boolean)

  const session: EnduranceSession = {
    id,
    activityType: 'marche',
    startedAt: dayStart + 12 * 3600_000,
    durationMin,
    caloriesBurned,
    externalId: id,
    source: 'googlefit',
    ...(deducted.length > 0
      ? { notes: `Pas du quotidien hors séances : ${day.steps.toLocaleString('fr-FR')} pas au total, dont ${deducted.join(' et ')} déjà comptées à part.` }
      : {}),
  }
  // Sans ce garde-fou, chaque ouverture de l'app réécrivait et repoussait vers
  // le VPS les 14 jours de marche, même inchangés (~14 POST /api/cloudsync).
  const previous = existing.find((s) => s.id === id)
  if (previous && previous.durationMin === session.durationMin && previous.caloriesBurned === session.caloriesBurned && previous.notes === session.notes) return
  await db.put('endurance', session)
  pushRecord('endurance', id, session)
}

/** Rattrape les pas quotidiens en Marche/Activité pour chaque jour connu de
 * Google Fit, pas seulement "aujourd'hui" — sinon un jour où l'app n'a pas
 * été ouverte (ou ouverte trop tôt, avant que les pas du jour ne soient
 * comptés) ne remontait jamais, même après coup. Idempotent : recalcule
 * chaque jour à chaque appel, donc une activité "Quotidien" ajoutée
 * rétroactivement corrige aussi la Marche déjà générée pour ce jour-là. */
export async function autoLogWalkFromStepsIfNeeded(settings: Settings): Promise<void> {
  await syncGoogleFit(BACKFILL_DAYS)
  await processStepsWalks(settings)
}

/** Même calcul, sans resynchroniser Google Fit (déjà fait par l'appelant). */
export async function processStepsWalks(settings: Settings): Promise<void> {
  const days = await getGoogleFitDays(BACKFILL_DAYS)
  for (const day of days) {
    await processDay(day, settings)
  }
}
