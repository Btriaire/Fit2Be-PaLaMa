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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function scanMachineResult(file: File): Promise<ParsedMachineResult> {
  const image = await fileToBase64(file)
  const r = await fetch('/api/parse-machine-result', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, mime: file.type || 'image/jpeg' }),
  })
  if (!r.ok) throw new Error('Analyse impossible')
  return r.json()
}
