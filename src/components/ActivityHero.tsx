import courseImg from '../assets/endurance/course.jpg'
import veloImg from '../assets/endurance/velo.jpg'
import marcheImg from '../assets/endurance/marche.jpg'
import type { EnduranceActivityType } from '../types'

const HERO_IMAGES: Partial<Record<EnduranceActivityType, string>> = {
  course: courseImg,
  velo: veloImg,
  marche: marcheImg,
}

const ACCENT_TINT: Partial<Record<EnduranceActivityType, string>> = {
  course: 'rgb(249 115 22 / 0.28)', // orange — effort
  velo: 'rgb(99 102 241 / 0.26)', // indigo
  marche: 'rgb(45 212 191 / 0.26)', // turquoise
}

export function hasActivityHero(activityType: EnduranceActivityType): boolean {
  return activityType in HERO_IMAGES
}

interface Props {
  activityType: EnduranceActivityType
  className?: string
}

/** Bannière photo pleine largeur avec calques dégradés transparents (vignette + teinte accent). */
export default function ActivityHero({ activityType, className = 'h-40' }: Props) {
  const img = HERO_IMAGES[activityType]
  if (!img) return null
  const tint = ACCENT_TINT[activityType]

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {/* Calque 1 — teinte accent, pour l'unité avec la palette de l'app */}
      <div className="absolute inset-0" style={{ background: tint }} />
      {/* Calque 2 — vignette radiale, concentre le regard */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 30%, transparent 30%, rgb(9 9 11 / 0.55) 100%)' }}
      />
      {/* Calque 3 — dégradé bas → haut, pour la lisibilité du texte / contenu qui suit */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgb(9 9 11 / 0.95) 0%, rgb(9 9 11 / 0.15) 55%, transparent 100%)' }}
      />
    </div>
  )
}
