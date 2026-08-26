// Silhouette avant/arrière originale (pas une image tierce) pour sélectionner
// visuellement un groupe musculaire — mêmes libellés que MUSCLE_GROUPS.

interface Props {
  selected: string | null
  onSelect: (group: string | null) => void
}

interface Zone {
  group: string
  d: string
}

const BASE = '#27272a'
const HIGHLIGHT = '#e2361c'

// Silhouette de fond (avant), tracé simplifié.
const FRONT_BODY =
  'M50,8 a9,9 0 1 0 0.1,0 M42,17 q8,4 16,0 q3,10 -2,16 q9,4 12,16 l3,30 q1,10 -2,16 l-3,20 h-6 l-1,-26 q-2,-8 -4,-8 q-2,0 -4,8 l-1,26 h-6 l-3,-20 q-3,-6 -2,-16 l3,-30 q3,-12 12,-16 q-5,-6 -2,-16 z'
const BACK_BODY = FRONT_BODY

const FRONT_ZONES: Zone[] = [
  { group: 'Trapèzes', d: 'M40,34 q10,6 20,0 l-2,7 q-8,3 -16,0 z' },
  { group: 'Épaules', d: 'M32,36 q6,-4 10,2 l-2,10 q-6,2 -10,-4 z' },
  { group: 'Épaules', d: 'M68,36 q-6,-4 -10,2 l2,10 q6,2 10,-4 z' },
  { group: 'Pectoraux', d: 'M42,40 q8,4 16,0 l1,10 q-9,5 -18,0 z' },
  { group: 'Biceps', d: 'M30,46 q4,-2 6,2 l-2,16 q-5,0 -6,-6 z' },
  { group: 'Biceps', d: 'M70,46 q-4,-2 -6,2 l2,16 q5,0 6,-6 z' },
  { group: 'Abdominaux', d: 'M43,50 q7,3 14,0 l1,20 q-8,4 -16,0 z' },
  { group: 'Avant-bras', d: 'M26,62 q4,-1 6,3 l-2,14 q-5,-1 -6,-6 z' },
  { group: 'Avant-bras', d: 'M74,62 q-4,-1 -6,3 l2,14 q5,-1 6,-6 z' },
  { group: 'Adducteurs', d: 'M46,72 q4,2 8,0 l0,20 q-4,2 -8,0 z' },
  { group: 'Quadriceps', d: 'M38,73 q5,2 6,0 l-1,26 q-5,1 -7,-3 z' },
  { group: 'Quadriceps', d: 'M62,73 q-5,2 -6,0 l1,26 q5,1 7,-3 z' },
  { group: 'Mollets', d: 'M40,100 q4,2 5,0 l-1,20 q-3,1 -5,-2 z' },
  { group: 'Mollets', d: 'M60,100 q-4,2 -5,0 l1,20 q3,1 5,-2 z' },
]

const BACK_ZONES: Zone[] = [
  { group: 'Nuque', d: 'M46,26 q4,3 8,0 l0,7 q-4,2 -8,0 z' },
  { group: 'Trapèzes', d: 'M38,34 q12,7 24,0 l-2,9 q-10,4 -20,0 z' },
  { group: 'Milieu du dos', d: 'M40,44 q10,4 20,0 l1,14 q-11,5 -22,0 z' },
  { group: 'Dos', d: 'M40,44 q10,4 20,0 l1,14 q-11,5 -22,0 z' },
  { group: 'Bas du dos', d: 'M43,58 q7,3 14,0 l0,10 q-7,3 -14,0 z' },
  { group: 'Triceps', d: 'M30,46 q4,-2 6,2 l-2,16 q-5,0 -6,-6 z' },
  { group: 'Triceps', d: 'M70,46 q-4,-2 -6,2 l2,16 q5,0 6,-6 z' },
  { group: 'Avant-bras', d: 'M26,62 q4,-1 6,3 l-2,14 q-5,-1 -6,-6 z' },
  { group: 'Avant-bras', d: 'M74,62 q-4,-1 -6,3 l2,14 q5,-1 6,-6 z' },
  { group: 'Fessiers', d: 'M42,68 q8,3 16,0 l0,10 q-8,3 -16,0 z' },
  { group: 'Abducteurs', d: 'M36,73 q4,2 4,0 l-1,20 q-4,1 -5,-4 z' },
  { group: 'Abducteurs', d: 'M64,73 q-4,2 -4,0 l1,20 q4,1 5,-4 z' },
  { group: 'Ischio-jambiers', d: 'M42,75 q8,2 16,0 l-1,20 q-7,2 -14,0 z' },
  { group: 'Mollets', d: 'M40,100 q4,2 5,0 l-1,20 q-3,1 -5,-2 z' },
  { group: 'Mollets', d: 'M60,100 q-4,2 -5,0 l1,20 q3,1 5,-2 z' },
]

function BodySvg({ zones, body, selected, onSelect }: { zones: Zone[]; body: string; selected: string | null; onSelect: (g: string | null) => void }) {
  return (
    <svg viewBox="0 0 100 128" className="h-full w-full">
      <path d={body} fill="#18181b" stroke={BASE} strokeWidth="0.5" />
      {zones.map((z, i) => (
        <path
          key={i}
          d={z.d}
          fill={selected === z.group ? HIGHLIGHT : '#3f3f46'}
          fillOpacity={selected === z.group ? 0.9 : 0.55}
          stroke={selected === z.group ? HIGHLIGHT : 'transparent'}
          strokeWidth="0.6"
          className="cursor-pointer transition-colors"
          onClick={() => onSelect(selected === z.group ? null : z.group)}
        >
          <title>{z.group}</title>
        </path>
      ))}
    </svg>
  )
}

export default function MuscleBodyMap({ selected, onSelect }: Props) {
  return (
    <div className="mb-3 flex items-center justify-center gap-6 rounded-xl bg-zinc-900/60 py-3">
      <div className="h-32 w-24">
        <BodySvg zones={FRONT_ZONES} body={FRONT_BODY} selected={selected} onSelect={onSelect} />
        <p className="mt-1 text-center text-[10px] text-zinc-600">Avant</p>
      </div>
      <div className="h-32 w-24">
        <BodySvg zones={BACK_ZONES} body={BACK_BODY} selected={selected} onSelect={onSelect} />
        <p className="mt-1 text-center text-[10px] text-zinc-600">Arrière</p>
      </div>
    </div>
  )
}
