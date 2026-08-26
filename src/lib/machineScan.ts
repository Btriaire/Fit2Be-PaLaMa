import type { EnduranceActivityType } from '../types'

export interface ParsedMachineResult {
  machineType: 'treadmill' | 'bike' | 'rower' | 'elliptical' | 'other'
  durationMin: number | null
  distanceKm: number | null
  calories: number | null
  avgHeartRate: number | null
  avgWatts: number | null
  avgSpeedKph: number | null
  avgMets: number | null
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
