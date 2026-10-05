import { NavLink } from 'react-router-dom'
import { Activity, Dumbbell, Home, HeartPulse, Apple } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/gym', label: 'Gym', icon: Dumbbell },
  { to: '/endurance', label: 'Activité', icon: Activity },
  { to: '/recovery', label: 'Récup', icon: HeartPulse },
  { to: '/nutrition', label: 'Diet', icon: Apple },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md flex items-stretch justify-between px-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-orange-400' : 'text-zinc-400 active:text-zinc-200',
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
