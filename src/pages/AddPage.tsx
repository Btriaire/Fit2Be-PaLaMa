import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import ActivityHero, { type HeroKey } from '../components/ActivityHero'
import { ACTIVITY_PHOTOS } from '../lib/activityPhotos'

type CatId = 'endurance' | 'musculation' | 'loisirs' | 'detente'

export const LOISIRS_INTENSE_IDS = ['football', 'tennis', 'basketball', 'dancing', 'climbing-indoor', 'playing-with-kids']
export const DETENTE_IDS = ['yoga', 'stretching', 'pilates', 'golf']

interface Category {
  id: CatId
  label: string
  sub: string
  heroKey?: HeroKey
  photoId?: string
}

const CATEGORIES: Category[] = [
  { id: 'endurance', label: 'Endurance', sub: 'Cardio & course', heroKey: 'course' },
  { id: 'musculation', label: 'Musculation', sub: 'Force & puissance', heroKey: 'gym' },
  { id: 'loisirs', label: 'Loisirs intense', sub: 'Sports & jeux', photoId: 'football' },
  { id: 'detente', label: 'Détente', sub: 'Yoga & mobilité', heroKey: 'yoga' },
]

export default function AddPage() {
  const navigate = useNavigate()

  function selectCategory(id: CatId) {
    if (id === 'endurance') navigate('/endurance')
    else if (id === 'musculation') navigate('/gym')
    else if (id === 'loisirs') navigate('/activities', { state: { openForm: true, filterIds: LOISIRS_INTENSE_IDS } })
    else navigate('/activities', { state: { openForm: true, filterIds: DETENTE_IDS } })
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">Ajouter</h1>
      </header>

      <p className="mb-4 px-1 text-sm text-zinc-500">Qu'est-ce que tu as fait ?</p>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat.id)}
            className="relative h-44 overflow-hidden rounded-2xl text-left active:scale-[0.97] transition-transform"
          >
            {cat.heroKey ? (
              <ActivityHero heroKey={cat.heroKey} className="h-44" />
            ) : cat.photoId && ACTIVITY_PHOTOS[cat.photoId] ? (
              <>
                <img src={ACTIVITY_PHOTOS[cat.photoId]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgb(9 9 11 / 0.95) 0%, rgb(9 9 11 / 0.15) 55%, transparent 100%)' }}
                />
              </>
            ) : (
              <div className="absolute inset-0 bg-zinc-900" />
            )}
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              <p className="text-base font-bold text-white drop-shadow">{cat.label}</p>
              <p className="mt-0.5 text-xs text-zinc-300 drop-shadow">{cat.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
