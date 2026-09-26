import { type EnduranceProgram, type ProgramPhase } from '../../lib/endurancePrograms'
import type { EnduranceActivityType } from '../../types'

// Palette de l'app (index.css @theme), pas des couleurs Tailwind par défaut —
// turquoise/indigo/orange sont les 3 seuls accents de l'identité visuelle.
export const INTENSITY_COLOR: Record<ProgramPhase['intensity'], string> = {
  facile: 'var(--color-turquoise)',
  modéré: 'var(--color-indigo)',
  dur: 'var(--color-orange)',
}

// Même échelle session-RPE que le mode Focus musculation (WorkoutRunner) —
// cohérence de vocabulaire entre les deux modules.
export const DIFFICULTY_LEVELS: Array<{ label: string; rpe: number; color: string }> = [
  { label: 'Facile', rpe: 3, color: 'bg-teal-500/15 text-teal-400' },
  { label: 'Modéré', rpe: 5, color: 'bg-teal-500/15 text-teal-400' },
  { label: 'Difficile', rpe: 7, color: 'bg-orange-500/15 text-orange-400' },
  { label: 'Très difficile', rpe: 8.5, color: 'bg-orange-500/15 text-orange-400' },
  { label: 'Effort maximal', rpe: 10, color: 'bg-red-500/15 text-red-400' },
]

/** Phase active à un instant donné du programme, ou null si le programme est terminé. */
export function getPhaseAt(program: EnduranceProgram, elapsedSec: number): { index: number; phase: ProgramPhase; remainingSec: number } | null {
  let acc = 0
  for (let i = 0; i < program.phases.length; i++) {
    const p = program.phases[i]
    if (elapsedSec < acc + p.durationSec) return { index: i, phase: p, remainingSec: acc + p.durationSec - elapsedSec }
    acc += p.durationSec
  }
  return null
}

export function programTotalSec(program: EnduranceProgram): number {
  return program.phases.reduce((s, p) => s + p.durationSec, 0)
}

// Activités où un suivi GPS a du sens (extérieur, mouvement continu).
export const GPS_CAPABLE: EnduranceActivityType[] = ['course', 'velo', 'marche']
// Machines d'intérieur — pas de GPS, mais un chrono live avec voix de
// motivation périodique a quand même du sens (tapis, vélo de salle).
export const INDOOR_TYPES: EnduranceActivityType[] = ['tapis', 'velo-appart']
// Fréquence des relances vocales pendant une séance live (indoor ou GPS).
export const MOTIVATION_INTERVAL_SEC = 180

export function formatPhaseDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  return `${min} min`
}
