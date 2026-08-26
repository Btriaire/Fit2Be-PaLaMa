// Silhouette avant/arrière originale (pas une image tierce) pour sélectionner
// visuellement un groupe musculaire — mêmes libellés que MUSCLE_GROUPS.
// Contour tracé en courbes (bezier) pour une vraie figure humanoïde
// (épaules, taille, hanches, galbe des membres), pas des rectangles bruts.

interface Props {
  selected: string | null
  onSelect: (group: string | null) => void
}

interface Zone {
  group: string
  shape: 'ellipse' | 'path'
  // ellipse
  cx?: number
  cy?: number
  rx?: number
  ry?: number
  // path
  d?: string
}

const HIGHLIGHT = '#e2361c'
const ZONE_DEFAULT = '#52525b'
const SKIN_FILL = '#18181b'
const SKIN_STROKE = '#3f3f46'

// Silhouette : tête, cou, torse (épaules → taille → hanches), bras et
// jambes galbés (bezier), mains/pieds arrondis. Identique avant/arrière,
// seules les zones surlignées par-dessus changent.
const TORSO =
  'M26,32 C22,37 22,41 25,45 C29,52 33,55 39,60 C34,67 29,72 32,78 C33,84 37,89 42,92 ' +
  'L58,92 C63,89 67,84 68,78 C71,72 66,67 61,60 C67,55 71,52 75,45 C78,41 78,37 74,32 ' +
  'C65,28 35,28 26,32 Z'

const ARM_L =
  'M24,36 C16,38 14,44 15,52 C16,62 18,70 17,80 C16,90 15,100 15,112 C15,120 16,126 17,131 ' +
  'L25,131 C25,126 24,120 25,112 C26,100 27,90 28,80 C29,70 30,62 30,52 C30,44 29,38 33,36 Z'
const ARM_R = 'M76,36 C84,38 86,44 85,52 C84,62 82,70 83,80 C84,90 85,100 85,112 C85,120 84,126 83,131 ' +
  'L75,131 C75,126 76,120 75,112 C74,100 73,90 72,80 C71,70 70,62 70,52 C70,44 71,38 67,36 Z'

const LEG_L =
  'M33,92 C28,100 28,104 30,110 C31,120 33,130 34,140 C32,148 30,155 31,160 C32,172 35,185 37,195 ' +
  'L42,195 C41,185 39,172 40,160 C41,155 43,148 44,140 C45,130 46,120 47,110 C48,104 48,100 49,92 Z'
const LEG_R =
  'M67,92 C72,100 72,104 70,110 C69,120 67,130 66,140 C68,148 70,155 69,160 C68,172 65,185 63,195 ' +
  'L58,195 C59,185 61,172 60,160 C59,155 57,148 56,140 C55,130 54,120 53,110 C52,104 52,100 51,92 Z'

const FOOT_L = 'M30,195 C27,198 27,203 31,206 L44,203 C46,201 45,197 42,195 Z'
const FOOT_R = 'M70,195 C73,198 73,203 69,206 L56,203 C54,201 55,197 58,195 Z'

const FRONT_ZONES: Zone[] = [
  { group: 'Trapèzes', shape: 'path', d: 'M50,24 L72,33 L63,44 L50,39 L37,44 L28,33 Z' },
  { group: 'Épaules', shape: 'ellipse', cx: 25, cy: 37, rx: 8, ry: 8 },
  { group: 'Épaules', shape: 'ellipse', cx: 75, cy: 37, rx: 8, ry: 8 },
  { group: 'Pectoraux', shape: 'ellipse', cx: 50, cy: 46, rx: 20, ry: 10 },
  { group: 'Biceps', shape: 'ellipse', cx: 18, cy: 64, rx: 7, ry: 16 },
  { group: 'Biceps', shape: 'ellipse', cx: 82, cy: 64, rx: 7, ry: 16 },
  { group: 'Abdominaux', shape: 'ellipse', cx: 50, cy: 70, rx: 13, ry: 20 },
  { group: 'Avant-bras', shape: 'ellipse', cx: 17, cy: 112, rx: 6, ry: 18 },
  { group: 'Avant-bras', shape: 'ellipse', cx: 83, cy: 112, rx: 6, ry: 18 },
  { group: 'Adducteurs', shape: 'ellipse', cx: 46, cy: 118, rx: 4, ry: 24 },
  { group: 'Adducteurs', shape: 'ellipse', cx: 54, cy: 118, rx: 4, ry: 24 },
  { group: 'Quadriceps', shape: 'ellipse', cx: 33, cy: 118, rx: 7, ry: 26 },
  { group: 'Quadriceps', shape: 'ellipse', cx: 67, cy: 118, rx: 7, ry: 26 },
  { group: 'Mollets', shape: 'ellipse', cx: 35, cy: 170, rx: 6, ry: 22 },
  { group: 'Mollets', shape: 'ellipse', cx: 65, cy: 170, rx: 6, ry: 22 },
]

const BACK_ZONES: Zone[] = [
  { group: 'Nuque', shape: 'ellipse', cx: 50, cy: 27, rx: 7, ry: 6 },
  { group: 'Trapèzes', shape: 'path', d: 'M50,24 L74,36 L62,52 L50,46 L38,52 L26,36 Z' },
  { group: 'Dos', shape: 'ellipse', cx: 50, cy: 52, rx: 22, ry: 14 },
  { group: 'Milieu du dos', shape: 'ellipse', cx: 50, cy: 52, rx: 22, ry: 14 },
  { group: 'Bas du dos', shape: 'ellipse', cx: 50, cy: 80, rx: 14, ry: 10 },
  { group: 'Triceps', shape: 'ellipse', cx: 18, cy: 64, rx: 7, ry: 16 },
  { group: 'Triceps', shape: 'ellipse', cx: 82, cy: 64, rx: 7, ry: 16 },
  { group: 'Avant-bras', shape: 'ellipse', cx: 17, cy: 112, rx: 6, ry: 18 },
  { group: 'Avant-bras', shape: 'ellipse', cx: 83, cy: 112, rx: 6, ry: 18 },
  { group: 'Fessiers', shape: 'ellipse', cx: 50, cy: 95, rx: 20, ry: 10 },
  { group: 'Abducteurs', shape: 'ellipse', cx: 31, cy: 110, rx: 6, ry: 20 },
  { group: 'Abducteurs', shape: 'ellipse', cx: 69, cy: 110, rx: 6, ry: 20 },
  { group: 'Ischio-jambiers', shape: 'ellipse', cx: 39, cy: 128, rx: 7, ry: 24 },
  { group: 'Ischio-jambiers', shape: 'ellipse', cx: 61, cy: 128, rx: 7, ry: 24 },
  { group: 'Mollets', shape: 'ellipse', cx: 35, cy: 170, rx: 6, ry: 22 },
  { group: 'Mollets', shape: 'ellipse', cx: 65, cy: 170, rx: 6, ry: 22 },
]

function ZoneShape({ zone, active, onSelect }: { zone: Zone; active: boolean; onSelect: () => void }) {
  const common = {
    fill: active ? HIGHLIGHT : ZONE_DEFAULT,
    fillOpacity: active ? 0.9 : 0.55,
    stroke: active ? HIGHLIGHT : 'transparent',
    strokeWidth: 0.8,
    className: 'cursor-pointer transition-colors duration-150',
    onClick: onSelect,
  }
  if (zone.shape === 'ellipse') {
    return (
      <ellipse cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry} {...common}>
        <title>{zone.group}</title>
      </ellipse>
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
    <svg viewBox="0 0 100 210" className="h-full w-full overflow-visible">
      {/* Silhouette de base */}
      <ellipse cx={50} cy={16} rx={10} ry={12} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" />
      <path d="M43,24 L57,24 L54,32 L46,32 Z" fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={TORSO} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={ARM_L} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={ARM_R} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <ellipse cx={21} cy={136} rx={6} ry={7} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" />
      <ellipse cx={79} cy={136} rx={6} ry={7} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" />
      <path d={LEG_L} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={LEG_R} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={FOOT_L} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={FOOT_R} fill={SKIN_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />

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
        <div className="h-44">
          <BodySvg zones={FRONT_ZONES} selected={selected} onSelect={onSelect} />
        </div>
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">Avant</p>
      </div>
      <div className="w-24">
        <div className="h-44">
          <BodySvg zones={BACK_ZONES} selected={selected} onSelect={onSelect} />
        </div>
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">Arrière</p>
      </div>
    </div>
  )
}
