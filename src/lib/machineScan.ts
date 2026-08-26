import type { EnduranceActivityType, MachineStats } from '../types'

export interface ParsedMachineResult {
  machineType: 'treadmill' | 'bike' | 'rower' | 'elliptical' | 'other'
  durationMin: number | null
  distanceKm: number | null
  calories: number | null
  avgHeartRate: number | null
  avgWatts: number | null
  avgSpeedKph: number | null
  avgMets: number | null
  peakHeartRate: number | null
  peakWatts: number | null
  peakSpeedKph: number | null
  elevationGainM: number | null
}

const MACHINE_TO_ACTIVITY: Record<ParsedMachineResult['machineType'], EnduranceActivityType> = {
  treadmill: 'tapis',
  bike: 'velo-appart',
  rower: 'rameur',
  elliptical: 'tapis',
  other: 'tapis',
}

export function machineTypeToActivityType(machineType: ParsedMachineResult['machineType']): EnduranceActivityType {
  return MACHINE_TO_ACTIVITY[machineType]
}

/** Conserve toutes les métriques lues sur la machine, pas seulement celles
 * qui alimentent le formulaire (durée/distance/FC) — utile pour les index de
 * progression cardiaque (watts/FC) plus tard. */
export function toMachineStats(result: ParsedMachineResult): MachineStats {
  return {
    machineType: result.machineType,
    avgWatts: result.avgWatts ?? undefined,
    avgSpeedKph: result.avgSpeedKph ?? undefined,
    avgMets: result.avgMets ?? undefined,
    peakHeartRate: result.peakHeartRate ?? undefined,
    peakWatts: result.peakWatts ?? undefined,
    peakSpeedKph: result.peakSpeedKph ?? undefined,
    elevationGainM: result.elevationGainM ?? undefined,
  }
}

/** Downscale + recompresse en JPEG côté client — les photos de téléphone
 * dépassent facilement la limite de 4.5 Mo du body des fonctions Vercel une
 * fois encodées en base64 ; 1600px/qualité 0.82 reste largement lisible pour
 * un écran de résultats et tient sous la limite. */
function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas unavailable'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl.split(',')[1] ?? '')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}

export async function scanMachineResult(file: File): Promise<ParsedMachineResult> {
  const image = await compressImage(file)
  const r = await fetch('/api/parse-machine-result', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, mime: 'image/jpeg' }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    throw new Error(body?.error ?? `Analyse impossible (${r.status})`)
  }
  return r.json()
}

/** Le tableau de résultats d'une machine ne tient souvent pas dans un seul
 * écran (ex: AVERAGE en haut, PEAK/ELEVATION en bas après scroll) — on
 * scanne chaque photo séparément et on fusionne : première valeur non-nulle
 * trouvée pour chaque champ, dans l'ordre des photos fournies. */
export async function scanMachineResults(files: File[]): Promise<ParsedMachineResult> {
  if (files.length === 0) throw new Error('Aucune photo')
  const results = await Promise.all(files.map((f) => scanMachineResult(f)))
  const merged = { ...results[0] }
  for (const r of results.slice(1)) {
    for (const key of Object.keys(merged) as (keyof ParsedMachineResult)[]) {
      if (merged[key] == null && r[key] != null) {
        ;(merged as Record<string, unknown>)[key] = r[key]
      }
    }
  }
  return merged
}
