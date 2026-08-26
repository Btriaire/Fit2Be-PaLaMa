import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

type CatId = 'endurance' | 'musculation' | 'loisirs' | 'detente'

export const LOISIRS_INTENSE_IDS = ['football', 'tennis', 'basketball', 'dancing', 'climbing-indoor', 'playing-with-kids']
export const DETENTE_IDS = ['yoga', 'stretching', 'pilates', 'golf']

interface Category {
  id: CatId
  label: string
  sub: string
  c1: string
  c2: string
  icon: (color: string) => React.ReactNode
}

const CATEGORIES: Category[] = [
  {
    id: 'endurance',
    label: 'Endurance',
    sub: 'Cardio & course',
    c1: '#2f4bd6',
    c2: '#5b3fc4',
    icon: (color) => (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="38" cy="12" r="5" fill={color} />
        <path d="M35 19c-3 5-4 9-2 15l4 8" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M35 19c3 5 5 10 3 15l-4 8" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M33 24l-8 4" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d="M37 22l9-3" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="2" y1="27" x2="14" y2="27" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        <line x1="5" y1="34" x2="14" y2="34" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
      </svg>
    ),
  },
  {
    id: 'musculation',
    label: 'Musculation',
    sub: 'Force & puissance',
    c1: '#e2361c',
    c2: '#ef4444',
    icon: (color) => (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <rect x="2" y="19" width="9" height="18" rx="3.5" fill={color} />
        <rect x="11" y="22" width="7" height="12" rx="2.5" fill={color} opacity="0.7" />
        <rect x="18" y="25" width="20" height="6" rx="3" fill={color} opacity="0.4" />
        <rect x="38" y="22" width="7" height="12" rx="2.5" fill={color} opacity="0.7" />
        <rect x="45" y="19" width="9" height="18" rx="3.5" fill={color} />
      </svg>
    ),
  },
  {
    id: 'loisirs',
    label: 'Loisirs intense',
    sub: 'Sports & jeux',
    c1: '#5b3fc4',
    c2: '#ec4899',
    icon: (color) => (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <ellipse cx="21" cy="20" rx="12" ry="15" stroke={color} strokeWidth="3" fill="none" />
        <line x1="10" y1="15" x2="32" y2="15" stroke={color} strokeWidth="1" opacity="0.4" />
        <line x1="10" y1="20" x2="32" y2="20" stroke={color} strokeWidth="1" opacity="0.4" />
        <line x1="10" y1="25" x2="32" y2="25" stroke={color} strokeWidth="1" opacity="0.4" />
        <path d="M30 31l16 16" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <circle cx="44" cy="14" r="7" fill={color} opacity="0.18" />
        <circle cx="44" cy="14" r="7" stroke={color} strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    id: 'detente',
    label: 'Détente',
    sub: 'Yoga & mobilité',
    c1: '#2f4bd6',
    c2: '#22d3ee',
    icon: (color) => (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <path d="M28 4C23 12 23 21 28 28C33 21 33 12 28 4Z" fill={color} />
        <path d="M12 15C15 22 21 25 28 28C25 20 18 15 12 15Z" fill={color} opacity="0.7" />
        <path d="M44 15C41 22 35 25 28 28C31 20 38 15 44 15Z" fill={color} opacity="0.7" />
        <path d="M7 31C11 34 19 33 28 28C21 27 12 27 7 31Z" fill={color} opacity="0.4" />
        <path d="M49 31C45 34 37 33 28 28C35 27 44 27 49 31Z" fill={color} opacity="0.4" />
        <path d="M18 49c2-5 5-8 10-16" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M38 49c-2-5-5-8-10-16" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
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
            className="relative min-h-[128px] overflow-hidden rounded-2xl p-3.5 text-left active:scale-[0.97] transition-transform"
            style={{
              background: `linear-gradient(140deg, ${cat.c1}1e 0%, ${cat.c2}10 100%)`,
              border: `1px solid ${cat.c1}30`,
            }}
          >
            <div className="pointer-events-none absolute -right-2 -top-2 opacity-15">{cat.icon(cat.c1)}</div>
            <div
              className="mb-2.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
              style={{ background: `${cat.c1}22`, border: `1px solid ${cat.c1}35` }}
            >
              <div style={{ width: 32, height: 32, transform: 'scale(0.58)' }}>{cat.icon(cat.c1)}</div>
            </div>
            <p className="text-sm font-semibold" style={{ color: cat.c1 }}>
              {cat.label}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{cat.sub}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
