// Variante lecture-seule de MuscleBodyMap (react-muscle-highlighter, MIT) :
// au lieu d'une couleur fixe par groupe, colore chaque groupe selon son
// intensité d'activation récente (dégradé froid -> chaud).

import Body, { type ExtendedBodyPart } from 'react-muscle-highlighter'
import { MUSCLE_GROUP_TO_SLUG } from '../lib/muscleSlugs'

interface Props {
  /** Groupe musculaire (FR) -> intensité 0..1 (0 = pas sollicité récemment, 1 = groupe le plus sollicité). */
  intensities: Record<string, number>
}

const DEFAULT_FILL = '#3f3f46'

// Dégradé froid -> chaud (indigo à peine visible -> rouge marque intense).
function heatColor(intensity: number): string {
  if (intensity <= 0) return DEFAULT_FILL
  const stops = [
    { t: 0, r: 63, g: 63, b: 70 }, // zinc-700 (neutre, quasi pas sollicité)
    { t: 0.5, r: 249, g: 115, b: 22 }, // orange-500
    { t: 1, r: 226, g: 54, b: 28 }, // rouge marque
  ]
  let lo = stops[0]
  let hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (intensity >= stops[i].t && intensity <= stops[i + 1].t) {
      lo = stops[i]
      hi = stops[i + 1]
      break
    }
  }
  const span = hi.t - lo.t || 1
  const localT = (intensity - lo.t) / span
  const r = Math.round(lo.r + (hi.r - lo.r) * localT)
  const g = Math.round(lo.g + (hi.g - lo.g) * localT)
  const b = Math.round(lo.b + (hi.b - lo.b) * localT)
  return `rgb(${r},${g},${b})`
}

function buildData(intensities: Record<string, number>): ExtendedBodyPart[] {
  return Object.entries(MUSCLE_GROUP_TO_SLUG).map(([group, slug]) => ({
    slug,
    color: heatColor(intensities[group] ?? 0),
  }))
}

function Panel({ side, intensities }: { side: 'front' | 'back'; intensities: Record<string, number> }) {
  return (
    <div className="w-32 shrink-0 [&_svg]:h-auto [&_svg]:w-full">
      <Body data={buildData(intensities)} side={side} gender="male" defaultFill={DEFAULT_FILL} border="#52525b" />
      <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">{side === 'front' ? 'Avant' : 'Arrière'}</p>
    </div>
  )
}

export default function MuscleHeatmap({ intensities }: Props) {
  return (
    <div className="flex items-center justify-center gap-6 overflow-x-auto rounded-xl bg-zinc-900/60 px-3 py-4">
      <Panel side="front" intensities={intensities} />
      <Panel side="back" intensities={intensities} />
    </div>
  )
}
