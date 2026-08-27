// Vraie planche anatomique (OpenStax Anatomy & Physiology, CC BY 4.0 — voir
// src/assets/body/CREDITS.txt) au lieu d'une silhouette dessinée à la main :
// l'utilisateur a rejeté deux fois les versions en formes vectorielles ("ça
// ressemble à des ovales"). Les zones cliquables sont des points chauds
// invisibles superposés en % de la position de l'image (pas de recalcul de
// viewBox), qui s'allument en rouge à la sélection sans cacher le dessin.

import muscleFront from '../assets/body/muscle-front.png'
import muscleBack from '../assets/body/muscle-back.png'

interface Props {
  selected: string | null
  onSelect: (group: string | null) => void
}

export interface Hotspot {
  group: string
  x: number // centre, % de la largeur de l'image
  y: number // centre, % de la hauteur de l'image
  w: number // % de la largeur de l'image
  h: number // % de la hauteur de l'image
}

export const FRONT_HOTSPOTS: Hotspot[] = [
  { group: 'Trapèzes', x: 48, y: 13, w: 14, h: 5 },
  { group: 'Épaules', x: 23, y: 20, w: 13, h: 9 },
  { group: 'Épaules', x: 75, y: 20, w: 13, h: 9 },
  { group: 'Pectoraux', x: 38, y: 25, w: 16, h: 9 },
  { group: 'Pectoraux', x: 60, y: 25, w: 16, h: 9 },
  { group: 'Biceps', x: 15, y: 31, w: 11, h: 11 },
  { group: 'Biceps', x: 83, y: 31, w: 11, h: 11 },
  { group: 'Abdominaux', x: 48, y: 39, w: 18, h: 15 },
  { group: 'Avant-bras', x: 9, y: 45, w: 9, h: 12 },
  { group: 'Avant-bras', x: 90, y: 45, w: 9, h: 12 },
  { group: 'Adducteurs', x: 48, y: 58, w: 10, h: 10 },
  { group: 'Quadriceps', x: 36, y: 63, w: 14, h: 15 },
  { group: 'Quadriceps', x: 62, y: 63, w: 14, h: 15 },
  { group: 'Mollets', x: 37, y: 84, w: 11, h: 11 },
  { group: 'Mollets', x: 61, y: 84, w: 11, h: 11 },
]

export const BACK_HOTSPOTS: Hotspot[] = [
  { group: 'Nuque', x: 48, y: 5, w: 10, h: 5 },
  { group: 'Trapèzes', x: 48, y: 15, w: 20, h: 8 },
  { group: 'Dos', x: 21, y: 24, w: 14, h: 12 },
  { group: 'Dos', x: 77, y: 24, w: 14, h: 12 },
  { group: 'Milieu du dos', x: 48, y: 27, w: 14, h: 8 },
  { group: 'Bas du dos', x: 48, y: 40, w: 14, h: 8 },
  { group: 'Triceps', x: 12, y: 32, w: 10, h: 11 },
  { group: 'Triceps', x: 87, y: 32, w: 10, h: 11 },
  { group: 'Avant-bras', x: 8, y: 46, w: 9, h: 12 },
  { group: 'Avant-bras', x: 91, y: 46, w: 9, h: 12 },
  { group: 'Fessiers', x: 38, y: 52, w: 14, h: 10 },
  { group: 'Fessiers', x: 60, y: 52, w: 14, h: 10 },
  { group: 'Abducteurs', x: 25, y: 60, w: 10, h: 12 },
  { group: 'Abducteurs', x: 74, y: 60, w: 10, h: 12 },
  { group: 'Ischio-jambiers', x: 39, y: 67, w: 12, h: 14 },
  { group: 'Ischio-jambiers', x: 60, y: 67, w: 12, h: 14 },
  { group: 'Mollets', x: 39, y: 85, w: 11, h: 11 },
  { group: 'Mollets', x: 60, y: 85, w: 11, h: 11 },
]

const HIGHLIGHT = '#e2361c'

function HotspotDot({ spot, active, onSelect }: { spot: Hotspot; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={spot.group}
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150"
      style={{
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        width: `${spot.w}%`,
        height: `${spot.h}%`,
        backgroundColor: active ? `${HIGHLIGHT}55` : 'transparent',
        boxShadow: active ? `0 0 0 2px ${HIGHLIGHT}, 0 0 14px 2px ${HIGHLIGHT}88` : 'none',
      }}
    />
  )
}

function BodyPanel({
  src,
  label,
  hotspots,
  selected,
  onSelect,
}: {
  src: string
  label: string
  hotspots: Hotspot[]
  selected: string | null
  onSelect: (g: string | null) => void
}) {
  return (
    <div className="w-28 shrink-0">
      <div className="relative overflow-hidden rounded-xl bg-zinc-100">
        <img src={src} alt={`Anatomie — vue ${label}`} className="block w-full select-none" draggable={false} />
        {hotspots.map((spot, i) => (
          <HotspotDot
            key={i}
            spot={spot}
            active={selected === spot.group}
            onSelect={() => onSelect(selected === spot.group ? null : spot.group)}
          />
        ))}
      </div>
      <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
    </div>
  )
}

export default function MuscleBodyMap({ selected, onSelect }: Props) {
  return (
    <div className="mb-3 flex items-center justify-center gap-6 overflow-x-auto rounded-xl bg-zinc-900/60 px-3 py-4">
      <BodyPanel src={muscleFront} label="Avant" hotspots={FRONT_HOTSPOTS} selected={selected} onSelect={onSelect} />
      <BodyPanel src={muscleBack} label="Arrière" hotspots={BACK_HOTSPOTS} selected={selected} onSelect={onSelect} />
    </div>
  )
}
