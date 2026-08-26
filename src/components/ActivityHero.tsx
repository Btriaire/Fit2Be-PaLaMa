import courseImg from '../assets/endurance/course.jpg'
import veloImg from '../assets/endurance/velo.jpg'
import marcheImg from '../assets/endurance/marche.jpg'
import gymImg from '../assets/endurance/gym.jpg'
import yogaImg from '../assets/endurance/yoga.jpg'
import foodImg from '../assets/endurance/food.jpg'
import type { EnduranceActivityType } from '../types'

export type HeroKey = EnduranceActivityType | 'gym' | 'yoga' | 'food'

const HERO_IMAGES: Partial<Record<HeroKey, string>> = {
  course: courseImg,
  velo: veloImg,
  marche: marcheImg,
  gym: gymImg,
  yoga: yogaImg,
  food: foodImg,
}

const ACCENT_TINT: Record<HeroKey, string> = {
  course: 'rgb(249 115 22 / 0.28)', // orange — effort
  velo: 'rgb(99 102 241 / 0.26)', // indigo
  marche: 'rgb(45 212 191 / 0.26)', // turquoise
  natation: 'rgb(45 212 191 / 0.26)',
  rameur: 'rgb(45 212 191 / 0.26)',
  'velo-appart': 'rgb(99 102 241 / 0.26)',
  tapis: 'rgb(249 115 22 / 0.28)',
  gym: 'rgb(249 115 22 / 0.3)',
  yoga: 'rgb(99 102 241 / 0.28)',
  food: 'rgb(45 212 191 / 0.26)',
}

export function hasHeroImage(key: HeroKey): boolean {
  return key in HERO_IMAGES
}

interface Props {
  heroKey: HeroKey
  className?: string
}

/** Bannière photo pleine largeur avec calques dégradés transparents (teinte accent + vignette + bas). */
export default function ActivityHero({ heroKey, className = 'h-40' }: Props) {
  const img = HERO_IMAGES[heroKey]
  if (!img) return null
  const tint = ACCENT_TINT[heroKey]

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: tint }} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 30%, transparent 30%, rgb(9 9 11 / 0.55) 100%)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgb(9 9 11 / 0.95) 0%, rgb(9 9 11 / 0.15) 55%, transparent 100%)' }}
      />
    </div>
  )
}
