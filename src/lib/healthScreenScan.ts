// OCR d'une capture d'écran Apple Health / Google Fit (détail fréquence
// cardiaque d'une séance) — bien plus précis que ce que l'app peut mesurer
// elle-même : ces sources ont un vrai capteur FC continu (montre connectée),
// avec zones et courbe de récupération après effort.

import { compressImage, compressImageForDisplay } from './machineScan'
import type { HealthScreenCapture } from '../types'

export async function scanHealthScreen(file: File): Promise<HealthScreenCapture> {
  const [image, screenshotDataUrl] = await Promise.all([compressImage(file), compressImageForDisplay(file)])
  const r = await fetch('/api/parse-health-screen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, mime: 'image/jpeg' }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    throw new Error(body?.error ?? `Analyse impossible (${r.status})`)
  }
  const data = (await r.json()) as {
    avgBpm: number | null
    zoneBreakdown: Array<{ zone: number; bpmMin: number; bpmMax: number | null; minutes: number }>
    recoveryPoints: Array<{ minutesAfter: number; bpm: number }>
  }
  return {
    avgBpm: data.avgBpm,
    zoneBreakdown: data.zoneBreakdown.filter((z) => z.zone >= 1 && z.zone <= 5) as HealthScreenCapture['zoneBreakdown'],
    recoveryPoints: data.recoveryPoints,
    screenshotDataUrl,
  }
}

/** FC de récupération (HRR) — chute de FC dans la 1ère minute après l'effort,
 * indicateur reconnu de forme cardiovasculaire (Cole et al. 1999, NEJM :
 * "Heart-Rate Recovery Immediately after Exercise as a Predictor of
 * Mortality"). Plus la chute est rapide, meilleure est la récupération. */
export function computeHrr1min(recoveryPoints: HealthScreenCapture['recoveryPoints']): number | null {
  const t0 = recoveryPoints.find((p) => p.minutesAfter === 0)
  const t1 = recoveryPoints.find((p) => p.minutesAfter === 1)
  if (!t0 || !t1) return null
  return Math.max(0, Math.round(t0.bpm - t1.bpm))
}
