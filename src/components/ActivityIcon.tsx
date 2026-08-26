// Pictogramme par activité (MET_ACTIVITIES) — Lucide (licence ISC, déjà une
// dépendance) pour la cohérence de style avec le reste de l'app ; un tracé
// original pour "escaliers", absent de Lucide.

import {
  Activity,
  Baby,
  Bike,
  Broom,
  Droplets,
  Flower2,
  Footprints,
  Goal,
  Hammer,
  Mountain,
  Music,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  StretchHorizontal,
  StretchVertical,
  Target,
  Trees,
  Volleyball,
  Waves,
  type LucideIcon,
} from 'lucide-react'

function Stairs({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 20h4v-4h4v-4h4V8h4V4" />
      <path d="M4 20V4" opacity={0.35} />
    </svg>
  )
}

const ACTIVITY_ICONS: Record<string, LucideIcon | typeof Stairs> = {
  'running-10kmh': Activity,
  'running-8kmh': Activity,
  'cycling-moderate': Bike,
  swimming: Waves,
  hiking: Trees,
  'walking-brisk': Footprints,
  football: Goal,
  tennis: Volleyball,
  basketball: Target,
  yoga: Flower2,
  dancing: Music,
  'climbing-indoor': Mountain,
  golf: Target,
  'playing-with-kids': Baby,
  stretching: StretchHorizontal,
  pilates: StretchVertical,
  gardening: Sprout,
  'house-cleaning': Broom,
  'grocery-shopping': ShoppingCart,
  stairs: Stairs,
  'carrying-groceries': ShoppingBag,
  diy: Hammer,
  'car-washing': Droplets,
}

export default function ActivityIcon({ activityId, size = 18, className }: { activityId: string; size?: number; className?: string }) {
  const Icon = ACTIVITY_ICONS[activityId] ?? Activity
  return <Icon size={size} className={className} />
}
