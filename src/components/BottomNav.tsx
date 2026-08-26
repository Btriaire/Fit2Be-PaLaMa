import { NavLink } from 'react-router-dom'
import { Dumbbell, Home, HeartPulse, Apple, Footprints } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/gym', label: 'Gym', icon: Dumbbell },
  { to: '/activities', label: 'Activités', icon: Footprints },
  { to: '/recovery', label: 'Récup', icon: HeartPulse },
  { to: '/nutrition', label: 'Déficit', icon: Apple },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md flex items-stretch justify-between px-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-orange-400' : 'text-zinc-500 active:text-zinc-300',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
