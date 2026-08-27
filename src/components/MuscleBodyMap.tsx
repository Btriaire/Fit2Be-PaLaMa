// Vraie planche anatomique segmentée par groupe musculaire — react-muscle-
// highlighter (MIT, SVG dessiné à la main par groupe, pas une planche photo
// avec des points chauds approximatifs par-dessus). Remplace deux tentatives
// précédentes (formes ovales dessinées à la main, puis planche OpenStax +
// hotspots) toutes deux jugées insuffisantes.

import Body, { type ExtendedBodyPart } from 'react-muscle-highlighter'
import { colorForMuscleGroup } from '../lib/muscleColors'
import { MUSCLE_GROUP_TO_SLUG, SLUG_TO_MUSCLE_GROUPS } from '../lib/muscleSlugs'

interface Props {
  selected: string | null
  onSelect: (group: string | null) => void
}

const DEFAULT_FILL = '#3f3f46'

function buildData(selected: string | null): ExtendedBodyPart[] {
  const selectedSlug = selected ? MUSCLE_GROUP_TO_SLUG[selected] : null
  return Object.entries(MUSCLE_GROUP_TO_SLUG).map(([group, slug]) => {
    const base = colorForMuscleGroup(group)
    const isSelected = slug === selectedSlug
    const dimmed = selectedSlug != null && !isSelected
    return { slug, color: dimmed ? `${base}2e` : base }
  })
}

function BodyPanel({ side, selected, onSelect }: { side: 'front' | 'back'; selected: string | null; onSelect: (g: string | null) => void }) {
  const data = buildData(selected)
  return (
    <div className="w-32 shrink-0 [&_svg]:h-auto [&_svg]:w-full">
      <Body
        data={data}
        side={side}
        gender="male"
        defaultFill={DEFAULT_FILL}
        border="#52525b"
        onBodyPartPress={(part) => {
          const groups = part.slug ? SLUG_TO_MUSCLE_GROUPS[part.slug] : undefined
          const group = groups?.[0] ?? null
          if (!group) return
          onSelect(selected === group ? null : group)
        }}
      />
      <p className="mt-1.5 text-center text-[10px] uppercase tracking-wide text-zinc-600">{side === 'front' ? 'Avant' : 'Arrière'}</p>
    </div>
  )
}

export default function MuscleBodyMap({ selected, onSelect }: Props) {
  return (
    <div className="mb-3 flex items-center justify-center gap-6 overflow-x-auto rounded-xl bg-zinc-900/60 px-3 py-4">
      <BodyPanel side="front" selected={selected} onSelect={onSelect} />
      <BodyPanel side="back" selected={selected} onSelect={onSelect} />
    </div>
  )
}
