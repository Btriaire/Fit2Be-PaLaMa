import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

interface Props {
  icon: ReactNode
  label: string
  /** Valeur affichée au centre-bas (déjà formatée). */
  display: string
  /** Objectif affiché à côté, ex: "/ 8 000". */
  goalLabel: string
  value: number | null
  goal: number
  color: string
}

/** Anneau de progression vers un objectif — pastille ✓ dès que l'objectif est atteint. */
export default function ActivityRing({ icon, label, display, goalLabel, value, goal, color }: Props) {
  const ratio = value == null || goal <= 0 ? 0 : Math.min(1, value / goal)
  const done = value != null && value >= goal
  const stroke = color
  const r = 34
  const c = 2 * Math.PI * r

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <div className="relative h-[84px] w-[84px]">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90 overflow-visible" aria-hidden="true">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            style={{ transition: 'stroke-dashoffset 700ms ease, stroke 300ms ease', filter: ratio > 0 ? `drop-shadow(0 0 ${done ? 8 : 4}px ${stroke}${done ? '99' : '66'})` : undefined }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: stroke }}>
          {icon}
        </div>
        {done && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-zinc-950"
            style={{ background: stroke }}
            aria-label="Objectif atteint"
          >
            <Check size={12} strokeWidth={3.5} />
          </span>
        )}
      </div>
      <p className="text-base font-bold leading-none text-zinc-50">{display}</p>
      <p className="text-[11px] leading-none text-zinc-500">
        {label} <span className="text-zinc-600">{goalLabel}</span>
      </p>
    </div>
  )
}
