// Silhouette avant/arrière originale (pas une image tierce) pour sélectionner
// visuellement un groupe musculaire — mêmes libellés que MUSCLE_GROUPS.
// Corps construit à partir de formes géométriques simples (tête/cou/torse/
// bras/jambes connectés), pas de tracés à main levée déconnectés.

interface Props {
  selected: string | null
  onSelect: (group: string | null) => void
}

interface Zone {
  group: string
  shape: 'rect' | 'circle' | 'path'
  // rect
  x?: number
  y?: number
  w?: number
  h?: number
  rx?: number
  // circle
  cx?: number
  cy?: number
  r?: number
  // path
  d?: string
}

const HIGHLIGHT = '#e2361c'
const ZONE_DEFAULT = '#52525b'

// Silhouette : tête, cou, torse (épaules→taille→hanches), bras et jambes
// reliés au tronc, mains/pieds arrondis. Identique avant/arrière (juste une
// silhouette), seules les zones surlignées changent.
const HEAD = { cx: 60, cy: 15, r: 10 }
const NECK = { x: 54, y: 23, w: 12, h: 9, rx: 3 }
const TORSO = 'M36,32 L84,32 L76,62 L80,95 L40,95 L44,62 Z'
const ARM_L = 'M30,36 L38,40 L34,78 L32,118 L24,118 L26,78 Z'
const ARM_R = 'M90,36 L82,40 L86,78 L88,118 L96,118 L94,78 Z'
const HAND_L = { cx: 28, cy: 124, r: 6 }
const HAND_R = { cx: 92, cy: 124, r: 6 }
const LEG_L = 'M41,95 L58,95 L54,145 L52,192 L43,192 L40,145 Z'
const LEG_R = 'M79,95 L62,95 L66,145 L68,192 L77,192 L80,145 Z'
const FOOT_L = { cx: 46, cy: 200, rx: 9, ry: 5 }
const FOOT_R = { cx: 74, cy: 200, rx: 9, ry: 5 }

const FRONT_ZONES: Zone[] = [
  { group: 'Trapèzes', shape: 'path', d: 'M60,30 L82,38 L73,50 L60,44 L47,50 L38,38 Z' },
  { group: 'Épaules', shape: 'circle', cx: 33, cy: 39, r: 7 },
  { group: 'Épaules', shape: 'circle', cx: 87, cy: 39, r: 7 },
  { group: 'Pectoraux', shape: 'rect', x: 42, y: 40, w: 36, h: 17, rx: 6 },
  { group: 'Biceps', shape: 'rect', x: 26, y: 44, w: 9, h: 26, rx: 4 },
  { group: 'Biceps', shape: 'rect', x: 85, y: 44, w: 9, h: 26, rx: 4 },
  { group: 'Abdominaux', shape: 'rect', x: 46, y: 59, w: 28, h: 32, rx: 6 },
  { group: 'Avant-bras', shape: 'rect', x: 23, y: 82, w: 9, h: 30, rx: 4 },
  { group: 'Avant-bras', shape: 'rect', x: 88, y: 82, w: 9, h: 30, rx: 4 },
  { group: 'Adducteurs', shape: 'rect', x: 52, y: 98, w: 8, h: 42, rx: 4 },
  { group: 'Adducteurs', shape: 'rect', x: 60, y: 98, w: 8, h: 42, rx: 4 },
  { group: 'Quadriceps', shape: 'rect', x: 41, y: 98, w: 13, h: 44, rx: 6 },
  { group: 'Quadriceps', shape: 'rect', x: 66, y: 98, w: 13, h: 44, rx: 6 },
  { group: 'Mollets', shape: 'rect', x: 44, y: 150, w: 10, h: 38, rx: 5 },
  { group: 'Mollets', shape: 'rect', x: 66, y: 150, w: 10, h: 38, rx: 5 },
]

const BACK_ZONES: Zone[] = [
  { group: 'Nuque', shape: 'rect', x: 54, y: 21, w: 12, h: 10, rx: 4 },
  { group: 'Trapèzes', shape: 'path', d: 'M60,30 L84,40 L74,58 L60,50 L46,58 L36,40 Z' },
  { group: 'Dos', shape: 'rect', x: 40, y: 52, w: 40, h: 25, rx: 8 },
  { group: 'Milieu du dos', shape: 'rect', x: 40, y: 52, w: 40, h: 25, rx: 8 },
  { group: 'Bas du dos', shape: 'rect', x: 46, y: 77, w: 28, h: 15, rx: 6 },
  { group: 'Triceps', shape: 'rect', x: 26, y: 44, w: 9, h: 26, rx: 4 },
  { group: 'Triceps', shape: 'rect', x: 85, y: 44, w: 9, h: 26, rx: 4 },
  { group: 'Avant-bras', shape: 'rect', x: 23, y: 82, w: 9, h: 30, rx: 4 },
  { group: 'Avant-bras', shape: 'rect', x: 88, y: 82, w: 9, h: 30, rx: 4 },
  { group: 'Fessiers', shape: 'rect', x: 40, y: 92, w: 40, h: 20, rx: 10 },
  { group: 'Abducteurs', shape: 'rect', x: 36, y: 100, w: 8, h: 38, rx: 4 },
  { group: 'Abducteurs', shape: 'rect', x: 76, y: 100, w: 8, h: 38, rx: 4 },
  { group: 'Ischio-jambiers', shape: 'rect', x: 46, y: 112, w: 12, h: 36, rx: 6 },
  { group: 'Ischio-jambiers', shape: 'rect', x: 62, y: 112, w: 12, h: 36, rx: 6 },
  { group: 'Mollets', shape: 'rect', x: 44, y: 150, w: 10, h: 38, rx: 5 },
  { group: 'Mollets', shape: 'rect', x: 66, y: 150, w: 10, h: 38, rx: 5 },
]

function ZoneShape({ zone, active, onSelect }: { zone: Zone; active: boolean; onSelect: () => void }) {
  const common = {
    fill: active ? HIGHLIGHT : ZONE_DEFAULT,
    fillOpacity: active ? 0.95 : 0.65,
    stroke: active ? HIGHLIGHT : 'transparent',
    strokeWidth: 0.8,
    className: 'cursor-pointer transition-colors duration-150',
    onClick: onSelect,
  }
  if (zone.shape === 'circle') {
    return (
      <circle cx={zone.cx} cy={zone.cy} r={zone.r} {...common}>
        <title>{zone.group}</title>
      </circle>
    )
  }
  if (zone.shape === 'rect') {
    return (
      <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={zone.rx} {...common}>
        <title>{zone.group}</title>
      </rect>
    )
  }
  return (
    <path d={zone.d} {...common}>
      <title>{zone.group}</title>
    </path>
  )
}

function BodySvg({ zones, selected, onSelect }: { zones: Zone[]; selected: string | null; onSelect: (g: string | null) => void }) {
  return (
    <svg viewBox="0 0 120 210" className="h-full w-full overflow-visible">
      {/* Silhouette de base */}
      <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" />
      <rect x={NECK.x} y={NECK.y} width={NECK.w} height={NECK.h} rx={NECK.rx} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" />
      <path d={TORSO} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" strokeLinejoin="round" />
      <path d={ARM_L} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" strokeLinejoin="round" />
      <path d={ARM_R} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" strokeLinejoin="round" />
      <circle cx={HAND_L.cx} cy={HAND_L.cy} r={HAND_L.r} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" />
      <circle cx={HAND_R.cx} cy={HAND_R.cy} r={HAND_R.r} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" />
      <path d={LEG_L} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" strokeLinejoin="round" />
      <path d={LEG_R} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" strokeLinejoin="round" />
      <ellipse cx={FOOT_L.cx} cy={FOOT_L.cy} rx={FOOT_L.rx} ry={FOOT_L.ry} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" />
      <ellipse cx={FOOT_R.cx} cy={FOOT_R.cy} rx={FOOT_R.rx} ry={FOOT_R.ry} fill="#18181b" stroke="#3f3f46" strokeWidth="0.6" />

      {/* Zones musculaires cliquables */}
      {zones.map((z, i) => (
        <ZoneShape key={i} zone={z} active={selected === z.group} onSelect={() => onSelect(selected === z.group ? null : z.group)} />
      ))}
    </svg>
  )
}

export default function MuscleBodyMap({ selected, onSelect }: Props) {
  return (
    <div className="mb-3 flex items-center justify-center gap-8 rounded-xl bg-zinc-900/60 py-4">
      <div className="w-24">
        <div className="h-40">
          <BodySvg zones={FRONT_ZONES} selected={selected} onSelect={onSelect} />
        </div>
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">Avant</p>
      </div>
      <div className="w-24">
        <div className="h-40">
          <BodySvg zones={BACK_ZONES} selected={selected} onSelect={onSelect} />
        </div>
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">Arrière</p>
      </div>
    </div>
  )
}
