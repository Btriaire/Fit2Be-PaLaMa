// Variante lecture-seule de MuscleBodyMap : au lieu d'un point sélectionné,
// colore chaque zone selon son intensité d'activation (volume d'entraînement
// récent) — mêmes points chauds, même planche anatomique, juste un rendu en
// dégradé plutôt qu'un état on/off.

import muscleFront from '../assets/body/muscle-front.png'
import muscleBack from '../assets/body/muscle-back.png'
import { FRONT_HOTSPOTS, BACK_HOTSPOTS, type Hotspot } from './MuscleBodyMap'

interface Props {
  /** Groupe musculaire -> intensité 0..1 (0 = pas sollicité récemment, 1 = groupe le plus sollicité). */
  intensities: Record<string, number>
}

// Dégradé froid -> chaud (bleu indigo à peine visible -> rouge orange intense),
// cohérent avec la palette de l'app (indigo = récupération, rouge/orange = charge).
function heatColor(intensity: number): { bg: string; glow: number } {
  if (intensity <= 0) return { bg: 'transparent', glow: 0 }
  const stops = [
    { t: 0, r: 79, g: 70, b: 229 }, // indigo-600
    { t: 0.5, r: 249, g: 115, b: 22 }, // orange-500
    { t: 1, r: 226, g: 54, b: 28 }, // rouge marque (HIGHLIGHT)
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
  return { bg: `rgba(${r},${g},${b},${0.25 + intensity * 0.45})`, glow: intensity }
}

function HeatDot({ spot, intensity }: { spot: Hotspot; intensity: number }) {
  const { bg, glow } = heatColor(intensity)
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        width: `${spot.w}%`,
        height: `${spot.h}%`,
        backgroundColor: bg,
        boxShadow: glow > 0.15 ? `0 0 ${6 + glow * 10}px ${1 + glow * 2}px ${bg}` : 'none',
      }}
    />
  )
}

function Panel({ src, label, hotspots, intensities }: { src: string; label: string; hotspots: Hotspot[]; intensities: Record<string, number> }) {
  return (
    <div className="w-28 shrink-0">
      <div className="relative overflow-hidden rounded-xl bg-zinc-100">
        <img src={src} alt={`Anatomie — vue ${label}`} className="block w-full select-none" draggable={false} />
        {hotspots.map((spot, i) => (
          <HeatDot key={i} spot={spot} intensity={intensities[spot.group] ?? 0} />
        ))}
      </div>
      <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
    </div>
  )
}

export default function MuscleHeatmap({ intensities }: Props) {
  return (
    <div className="flex items-center justify-center gap-6 overflow-x-auto rounded-xl bg-zinc-900/60 px-3 py-4">
      <Panel src={muscleFront} label="Avant" hotspots={FRONT_HOTSPOTS} intensities={intensities} />
      <Panel src={muscleBack} label="Arrière" hotspots={BACK_HOTSPOTS} intensities={intensities} />
    </div>
  )
}
