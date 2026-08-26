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
