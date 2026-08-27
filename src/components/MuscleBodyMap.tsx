// Silhouette avant/arrière originale (pas une image tierce) pour sélectionner
// visuellement un groupe musculaire — mêmes libellés que MUSCLE_GROUPS.
// Chaque groupe est dessiné avec sa vraie forme anatomique (pecs en 2 masses,
// abdos en tablette segmentée, deltoïdes en capuchon, biceps avec un pic,
// fessiers en 2 masses...) plutôt que des ellipses génériques, + quelques
// traits de définition statiques (ligne blanche, clavicules) pour la lecture
// musculaire — pas un tracé tiers, un dessin vectoriel maison.

interface Props {
  selected: string | null
  onSelect: (group: string | null) => void
}

interface Zone {
  group: string
  d: string
}

const HIGHLIGHT = '#e2361c'
const ZONE_DEFAULT = '#52525b'
const SKIN_STROKE = '#3f3f46'
const DEFINITION_STROKE = 'rgb(9 9 11 / 0.35)'

// Silhouette : tête, cou, torse (épaules → taille → hanches), bras et
// jambes galbés (bezier), mains/pieds arrondis. Identique avant/arrière,
// seules les zones surlignées et les traits de définition par-dessus changent.
const TORSO =
  'M26,32 C22,37 22,41 25,45 C29,52 33,55 39,60 C34,67 29,72 32,78 C33,84 37,89 42,92 ' +
  'L58,92 C63,89 67,84 68,78 C71,72 66,67 61,60 C67,55 71,52 75,45 C78,41 78,37 74,32 ' +
  'C65,28 35,28 26,32 Z'

const ARM_L =
  'M24,36 C16,38 14,44 15,52 C16,62 18,70 17,80 C16,90 15,100 15,112 C15,120 16,126 17,131 ' +
  'L25,131 C25,126 24,120 25,112 C26,100 27,90 28,80 C29,70 30,62 30,52 C30,44 29,38 33,36 Z'
const ARM_R =
  'M76,36 C84,38 86,44 85,52 C84,62 82,70 83,80 C84,90 85,100 85,112 C85,120 84,126 83,131 ' +
  'L75,131 C75,126 76,120 75,112 C74,100 73,90 72,80 C71,70 70,62 70,52 C70,44 71,38 67,36 Z'

const LEG_L =
  'M33,92 C28,100 28,104 30,110 C31,120 33,130 34,140 C32,148 30,155 31,160 C32,172 35,185 37,195 ' +
  'L42,195 C41,185 39,172 40,160 C41,155 43,148 44,140 C45,130 46,120 47,110 C48,104 48,100 49,92 Z'
const LEG_R =
  'M67,92 C72,100 72,104 70,110 C69,120 67,130 66,140 C68,148 70,155 69,160 C68,172 65,185 63,195 ' +
  'L58,195 C59,185 61,172 60,160 C59,155 57,148 56,140 C55,130 54,120 53,110 C52,104 52,100 51,92 Z'

const FOOT_L = 'M30,195 C27,198 27,203 31,206 L44,203 C46,201 45,197 42,195 Z'
const FOOT_R = 'M70,195 C73,198 73,203 69,206 L56,203 C54,201 55,197 58,195 Z'

// ---- Traits de définition statiques (non cliquables) ----
const FRONT_DEFINITION = [
  'M50,40 L50,58', // ligne médiane du sternum
  'M50,60 L50,88', // linea alba
  'M40,35 C44,33 48,33 50,35', // clavicule gauche
  'M60,35 C56,33 52,33 50,35', // clavicule droite
  'M34,50 C36,58 38,66 37,74', // oblique gauche
  'M66,50 C64,58 62,66 63,74', // oblique droite
]
const BACK_DEFINITION = [
  'M50,32 L50,88', // colonne
  'M38,40 C43,50 46,58 50,60', // trapèze gauche
  'M62,40 C57,50 54,58 50,60', // trapèze droite
  'M40,62 C42,70 44,78 43,86', // érecteur gauche
  'M60,62 C58,70 56,78 57,86', // érecteur droit
]

const FRONT_ZONES: Zone[] = [
  { group: 'Trapèzes', d: 'M50,24 L72,33 L63,44 L50,39 L37,44 L28,33 Z' },
  // Deltoïdes : capuchon arrondi au-dessus de la jonction bras/épaule.
  {
    group: 'Épaules',
    d: 'M17,29 C12,31 10,37 12,43 C14,48 20,49 24,45 C27,41 26,34 22,30 C20,28 19,28 17,29 Z',
  },
  {
    group: 'Épaules',
    d: 'M83,29 C88,31 90,37 88,43 C86,48 80,49 76,45 C73,41 74,34 78,30 C80,28 81,28 83,29 Z',
  },
  // Pectoraux : deux masses distinctes avec un creux au sternum.
  { group: 'Pectoraux', d: 'M26,40 C25,44 26,50 30,53 C35,56 42,55 45,50 C47,46 46,41 43,39 C37,36 30,37 26,40 Z' },
  { group: 'Pectoraux', d: 'M74,40 C75,44 74,50 70,53 C65,56 58,55 55,50 C53,46 54,41 57,39 C63,36 70,37 74,40 Z' },
  // Biceps : pic au milieu du bras, pas un ovale plat.
  { group: 'Biceps', d: 'M13,49 C11,57 12,66 15,74 C17,79 23,79 26,75 C28,67 27,57 25,48 C23,44 16,44 13,49 Z' },
  { group: 'Biceps', d: 'M87,49 C89,57 88,66 85,74 C83,79 77,79 74,75 C72,67 73,57 75,48 C77,44 84,44 87,49 Z' },
  // Abdominaux : tablette en 3x2, chaque case cliquable dans le même groupe.
  { group: 'Abdominaux', d: 'M39,58 h9 a2,2 0 0 1 2,2 v6 a2,2 0 0 1 -2,2 h-9 a2,2 0 0 1 -2,-2 v-6 a2,2 0 0 1 2,-2 Z' },
  { group: 'Abdominaux', d: 'M52,58 h9 a2,2 0 0 1 2,2 v6 a2,2 0 0 1 -2,2 h-9 a2,2 0 0 1 -2,-2 v-6 a2,2 0 0 1 2,-2 Z' },
  { group: 'Abdominaux', d: 'M38,69 h9.5 a2,2 0 0 1 2,2 v6 a2,2 0 0 1 -2,2 h-9.5 a2,2 0 0 1 -2,-2 v-6 a2,2 0 0 1 2,-2 Z' },
  { group: 'Abdominaux', d: 'M50.5,69 h9.5 a2,2 0 0 1 2,2 v6 a2,2 0 0 1 -2,2 h-9.5 a2,2 0 0 1 -2,-2 v-6 a2,2 0 0 1 2,-2 Z' },
  { group: 'Abdominaux', d: 'M38,80 h10 a2,2 0 0 1 2,2 v5 a2,2 0 0 1 -2,2 h-10 a2,2 0 0 1 -2,-2 v-5 a2,2 0 0 1 2,-2 Z' },
  { group: 'Abdominaux', d: 'M50,80 h10 a2,2 0 0 1 2,2 v5 a2,2 0 0 1 -2,2 h-10 a2,2 0 0 1 -2,-2 v-5 a2,2 0 0 1 2,-2 Z' },
  { group: 'Avant-bras', d: 'M13,84 C11,93 12,103 15,111 C17,115 21,115 23,112 C25,102 24,92 22,83 C20,80 15,80 13,84 Z' },
  { group: 'Avant-bras', d: 'M87,84 C89,93 88,103 85,111 C83,115 79,115 77,112 C75,102 76,92 78,83 C80,80 85,80 87,84 Z' },
  { group: 'Adducteurs', d: 'M45,98 C43,112 43,126 45,140 C46,143 49,143 50,140 L50,98 Z' },
  { group: 'Adducteurs', d: 'M55,98 C57,112 57,126 55,140 C54,143 51,143 50,140 L50,98 Z' },
  // Quadriceps : galbe (vaste externe) plus prononcé que l'ellipse d'origine.
  { group: 'Quadriceps', d: 'M28,96 C24,106 23,118 25,132 C27,141 34,145 40,141 C43,130 43,112 41,97 C38,93 31,93 28,96 Z' },
  { group: 'Quadriceps', d: 'M72,96 C76,106 77,118 75,132 C73,141 66,145 60,141 C57,130 57,112 59,97 C62,93 69,93 72,96 Z' },
  { group: 'Mollets', d: 'M29,152 C27,160 27,170 29,180 C31,187 39,187 41,180 C43,170 42,159 39,150 C36,147 31,148 29,152 Z' },
  { group: 'Mollets', d: 'M71,152 C73,160 73,170 71,180 C69,187 61,187 59,180 C57,170 58,159 61,150 C64,147 69,148 71,152 Z' },
]

const BACK_ZONES: Zone[] = [
  { group: 'Nuque', d: 'M44,21 C44,26 46,30 50,30 C54,30 56,26 56,21 C56,24 53,26 50,26 C47,26 44,24 44,21 Z' },
  { group: 'Trapèzes', d: 'M50,24 L74,36 L62,52 L50,46 L38,52 L26,36 Z' },
  // Dorsaux : forme en "aile" qui s'élargit vers les côtes puis se resserre à la taille.
  { group: 'Dos', d: 'M28,42 C26,50 28,58 33,64 C38,68 44,66 46,60 C47,52 45,44 40,40 C36,38 30,39 28,42 Z' },
  { group: 'Dos', d: 'M72,42 C74,50 72,58 67,64 C62,68 56,66 54,60 C53,52 55,44 60,40 C64,38 70,39 72,42 Z' },
  { group: 'Milieu du dos', d: 'M40,50 C39,56 41,62 46,64 C50,65 50,65 54,64 C59,62 61,56 60,50 C58,45 42,45 40,50 Z' },
  { group: 'Bas du dos', d: 'M42,74 C41,79 43,84 47,86 C49,87 51,87 53,86 C57,84 59,79 58,74 C55,70 45,70 42,74 Z' },
  { group: 'Triceps', d: 'M13,49 C11,57 12,66 15,74 C17,79 23,79 26,75 C28,67 27,57 25,48 C23,44 16,44 13,49 Z' },
  { group: 'Triceps', d: 'M87,49 C89,57 88,66 85,74 C83,79 77,79 74,75 C72,67 73,57 75,48 C77,44 84,44 87,49 Z' },
  { group: 'Avant-bras', d: 'M13,84 C11,93 12,103 15,111 C17,115 21,115 23,112 C25,102 24,92 22,83 C20,80 15,80 13,84 Z' },
  { group: 'Avant-bras', d: 'M87,84 C89,93 88,103 85,111 C83,115 79,115 77,112 C75,102 76,92 78,83 C80,80 85,80 87,84 Z' },
  // Fessiers : deux masses rondes, pas un ovale unique.
  { group: 'Fessiers', d: 'M32,88 C29,92 29,98 33,102 C37,105 42,104 44,100 C46,95 45,90 41,87 C38,85 34,85 32,88 Z' },
  { group: 'Fessiers', d: 'M68,88 C71,92 71,98 67,102 C63,105 58,104 56,100 C54,95 55,90 59,87 C62,85 66,85 68,88 Z' },
  { group: 'Abducteurs', d: 'M26,100 C23,110 23,122 26,134 C28,139 33,139 34,134 C36,122 35,110 32,99 C30,96 27,97 26,100 Z' },
  { group: 'Abducteurs', d: 'M74,100 C77,110 77,122 74,134 C72,139 67,139 66,134 C64,122 65,110 68,99 C70,96 73,97 74,100 Z' },
  { group: 'Ischio-jambiers', d: 'M36,98 C33,110 33,122 36,136 C38,142 46,142 47,136 C48,122 47,109 44,97 C41,93 38,94 36,98 Z' },
  { group: 'Ischio-jambiers', d: 'M64,98 C67,110 67,122 64,136 C62,142 54,142 53,136 C52,122 53,109 56,97 C59,93 62,94 64,98 Z' },
  { group: 'Mollets', d: 'M29,152 C27,160 27,170 29,180 C31,187 39,187 41,180 C43,170 42,159 39,150 C36,147 31,148 29,152 Z' },
  { group: 'Mollets', d: 'M71,152 C73,160 73,170 71,180 C69,187 61,187 59,180 C57,170 58,159 61,150 C64,147 69,148 71,152 Z' },
]

function ZoneShape({ zone, active, onSelect }: { zone: Zone; active: boolean; onSelect: () => void }) {
  return (
    <path
      d={zone.d}
      fill={active ? HIGHLIGHT : ZONE_DEFAULT}
      fillOpacity={active ? 0.92 : 0.55}
      stroke={active ? HIGHLIGHT : 'transparent'}
      strokeWidth={0.8}
      className="cursor-pointer transition-colors duration-150"
      onClick={onSelect}
    >
      <title>{zone.group}</title>
    </path>
  )
}

function BodySvg({
  zones,
  definitionLines,
  gradientId,
  selected,
  onSelect,
}: {
  zones: Zone[]
  definitionLines: string[]
  gradientId: string
  selected: string | null
  onSelect: (g: string | null) => void
}) {
  return (
    <svg viewBox="0 0 100 210" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="45%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#111113" />
        </linearGradient>
      </defs>

      {/* Silhouette de base */}
      <ellipse cx={50} cy={16} rx={10} ry={12} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" />
      <path d="M43,24 L57,24 L54,32 L46,32 Z" fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={TORSO} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={ARM_L} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={ARM_R} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <ellipse cx={21} cy={136} rx={6} ry={7} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" />
      <ellipse cx={79} cy={136} rx={6} ry={7} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" />
      <path d={LEG_L} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={LEG_R} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={FOOT_L} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />
      <path d={FOOT_R} fill={`url(#${gradientId})`} stroke={SKIN_STROKE} strokeWidth="0.6" strokeLinejoin="round" />

      {/* Traits de définition (statiques, non cliquables) */}
      {definitionLines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={DEFINITION_STROKE} strokeWidth={0.5} strokeLinecap="round" />
      ))}

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
          <BodySvg zones={FRONT_ZONES} definitionLines={FRONT_DEFINITION} gradientId="bodyGradFront" selected={selected} onSelect={onSelect} />
        </div>
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">Avant</p>
      </div>
      <div className="w-24">
        <div className="h-44">
          <BodySvg zones={BACK_ZONES} definitionLines={BACK_DEFINITION} gradientId="bodyGradBack" selected={selected} onSelect={onSelect} />
        </div>
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">Arrière</p>
      </div>
    </div>
  )
}
