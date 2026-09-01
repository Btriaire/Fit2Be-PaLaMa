// Sync bridge to NutriTracker Palama (~/nutri-tracker). Best-effort only —
// every call swallows its own errors so a sync hiccup (offline, endpoint
// down) never blocks a local save. Goes through our own /api/nutritracker
// serverless proxy so the shared secret never reaches the browser.

interface PullWeightResult {
  weightKg: number | null
  date: string | null
  source: 'withings' | 'vibefit' | null
}

export async function pushWeightToNutriTracker(weightKg: number, date?: string) {
  try {
    await fetch('/api/nutritracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'weight', weightKg, date }),
    })
  } catch {
    // offline or endpoint unavailable — local save already succeeded, ignore
  }
}

export async function pushFoodToNutriTracker(entry: {
  name: string
  calories: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  sugarG?: number
  date?: string
}) {
  try {
    await fetch('/api/nutritracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'food', ...entry }),
    })
  } catch {
    // same — best effort
  }
}

/** Pousse la photo du jour vers le journal alimentaire de NutriTracker,
 * comme capture de la journée — le serveur ne l'enregistre que s'il n'y en a
 * pas déjà une pour cette date (jamais de remplacement forcé), voir
 * app/api/vibefit/route.ts type "daily-photo". */
export async function pushDailyPhotoToNutriTracker(dataUrl: string, date?: string) {
  try {
    await fetch('/api/nutritracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'daily-photo', dataUrl, date }),
    })
  } catch {
    // offline or endpoint unavailable — local save already succeeded, ignore
  }
}

export async function pushActivityToNutriTracker(activity: {
  name: string
  activityType: number
  durationMin: number
  caloriesBurned?: number
  date?: string
}) {
  try {
    await fetch('/api/nutritracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'activity', ...activity }),
    })
  } catch {
    // same — best effort
  }
}

export async function pullLatestWeightFromNutriTracker(): Promise<PullWeightResult> {
  try {
    const r = await fetch('/api/nutritracker')
    if (!r.ok) return { weightKg: null, date: null, source: null }
    const data = await r.json()
    return { weightKg: data.weightKg ?? null, date: data.date ?? null, source: data.source ?? null }
  } catch {
    return { weightKg: null, date: null, source: null }
  }
}

interface GoogleFitDayRaw {
  date: string
  steps: number
  activeCaloriesBurned: number
  activeMinutes: number
  heartRateAvg: number | null
  sleepMinutes: number | null
}

/** Google Fit n'est connecté que côté NutriTracker (OAuth) — on lit ici ce
 * qu'il a déjà synchronisé, on ne fait jamais l'OAuth nous-mêmes. */
export async function pullGoogleFitFromNutriTracker(days = 7): Promise<GoogleFitDayRaw[]> {
  try {
    const r = await fetch(`/api/nutritracker?type=googlefit&days=${days}`)
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data.days) ? data.days : []
  } catch {
    return []
  }
}

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snacks: 'Collations',
}

export interface RemoteNutritionTotals {
  date: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  sugarG: number
  entryCount: number
  byMeal: Partial<Record<MealCategory, { calories: number; proteinG: number; carbsG: number; fatG: number; items: string[] }>>
}

const EMPTY_NUTRITION: RemoteNutritionTotals = { date: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0, entryCount: 0, byMeal: {} }

/** Total du jour loggé directement dans NutriTracker (hors ce que VibeFit lui
 * a déjà poussé — le serveur les exclut), pour compléter la balance
 * calorique locale sans compter deux fois les repas ajoutés depuis VibeFit. */
export async function pullNutritionFromNutriTracker(date: string): Promise<RemoteNutritionTotals> {
  try {
    const r = await fetch(`/api/nutritracker?type=nutrition&date=${date}`)
    if (!r.ok) return EMPTY_NUTRITION
    const data = await r.json()
    return {
      date: data.date ?? date,
      calories: data.calories ?? 0,
      proteinG: data.proteinG ?? 0,
      carbsG: data.carbsG ?? 0,
      fatG: data.fatG ?? 0,
      sugarG: data.sugarG ?? 0,
      entryCount: data.entryCount ?? 0,
      byMeal: data.byMeal ?? {},
    }
  } catch {
    return EMPTY_NUTRITION
  }
}

export interface RemoteCardiacDay {
  date: string
  heartRateAvg: number | null
  heartRateResting: number | null
  systolicBP: number | null
  diastolicBP: number | null
  source: string
}

/** FC (moyenne/repos) et tension artérielle des N derniers jours connus côté
 * NutriTracker (Apple Health / Withings) — VibeFit n'a pas de capteur propre. */
export async function pullCardiacRangeFromNutriTracker(days = 14): Promise<RemoteCardiacDay[]> {
  try {
    const r = await fetch(`/api/nutritracker?type=cardiac&days=${days}`)
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data.days) ? data.days : []
  } catch {
    return []
  }
}

/** Même total que pullNutritionFromNutriTracker, mais pour chacun des N
 * derniers jours en un seul appel — pour tracer une tendance (ex: Progression)
 * sans faire N requêtes date par date. */
export async function pullNutritionRangeFromNutriTracker(days = 14): Promise<RemoteNutritionTotals[]> {
  try {
    const r = await fetch(`/api/nutritracker?type=nutrition-range&days=${days}`)
    if (!r.ok) return []
    const data = await r.json()
    const rows = Array.isArray(data.days) ? data.days : []
    return rows.map((d: Partial<RemoteNutritionTotals>) => ({
      date: d.date ?? '',
      calories: d.calories ?? 0,
      proteinG: d.proteinG ?? 0,
      carbsG: d.carbsG ?? 0,
      fatG: d.fatG ?? 0,
      sugarG: d.sugarG ?? 0,
      entryCount: d.entryCount ?? 0,
    }))
  } catch {
    return []
  }
}

export interface RemoteActivity {
  id: string
  date: string
  name: string
  activityType: number
  durationMin: number
  caloriesBurned: number | null
  source: string
  startMs: number | null
  distanceM: number | null
  avgSpeedKmh: number | null
  heartRateAvg: number | null
  elevationGainM: number | null
}

export interface RemoteMood {
  date: string
  mood: number | null // 1-5
  stressLevel: number | null
  energy: number | null
  tags: string[]
}

const EMPTY_MOOD: RemoteMood = { date: '', mood: null, stressLevel: null, energy: null, tags: [] }

/** "Humeur du jour" saisie côté NutriTracker (widget mood circle) — lue ici
 * en lecture seule, jamais modifiée depuis VibeFit. */
export async function pullMoodOfTheDay(date?: string): Promise<RemoteMood> {
  try {
    const qs = date ? `&date=${date}` : ''
    const r = await fetch(`/api/nutritracker?type=mood${qs}`)
    if (!r.ok) return EMPTY_MOOD
    const data = await r.json()
    return {
      date: data.date ?? date ?? '',
      mood: data.mood ?? null,
      stressLevel: data.stressLevel ?? null,
      energy: data.energy ?? null,
      tags: Array.isArray(data.tags) ? data.tags : [],
    }
  } catch {
    return EMPTY_MOOD
  }
}

/** Historique des activités loggées côté NutriTracker (dans son UI, pas
 * celles que VibeFit lui a déjà poussées — le serveur les exclut). */
export async function pullActivityHistoryFromNutriTracker(days = 30): Promise<RemoteActivity[]> {
  try {
    const r = await fetch(`/api/nutritracker?type=activities&days=${days}`)
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data.activities) ? data.activities : []
  } catch {
    return []
  }
}
