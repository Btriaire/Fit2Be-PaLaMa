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
  course: 'rgb(226 54 28 / 0.3)', // rouge écarlate — effort
  velo: 'rgb(91 63 196 / 0.28)', // violet-bleu foncé
  marche: 'rgb(47 75 214 / 0.28)', // bleu foncé
  natation: 'rgb(47 75 214 / 0.28)',
  rameur: 'rgb(47 75 214 / 0.28)',
  'velo-appart': 'rgb(91 63 196 / 0.28)',
  tapis: 'rgb(226 54 28 / 0.3)',
  gym: 'rgb(226 54 28 / 0.32)',
  yoga: 'rgb(91 63 196 / 0.3)',
  food: 'rgb(47 75 214 / 0.28)',
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
