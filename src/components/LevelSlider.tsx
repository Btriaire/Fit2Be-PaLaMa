import type { ReactNode } from 'react'

/**
 * Curseur explicite : la question, le niveau en clair et ce qu'il veut dire,
 * les bornes nommées et des repères à chaque cran — plutôt qu'un curseur nu
 * dont on ne sait pas ce que représente la position.
 */
export default function LevelSlider({
  icon,
  question,
  value,
  min,
  max,
  step = 1,
  levelLabel,
  hint,
  color,
  minLabel,
  maxLabel,
  valueText,
  badge,
  onChange,
}: {
  icon: ReactNode
  question: string
  value: number
  min: number
  max: number
  step?: number
  levelLabel: string
  hint: string
  color: string
  minLabel: string
  maxLabel: string
  /** Valeur affichée à droite du niveau (ex: "6/10", "7h30"). */
  valueText: string
  badge?: ReactNode
  onChange: (v: number) => void
}) {
  const fill = ((value - min) / (max - min)) * 100
  const ticks = Math.round((max - min) / step) + 1
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-200">
          <span className="shrink-0" style={{ color }}>
            {icon}
          </span>
          <span className="truncate">{question}</span>
          {badge}
        </span>
        <span className="shrink-0 text-sm font-semibold" style={{ color }}>
          {levelLabel} <span className="text-xs font-normal text-zinc-500">{valueText}</span>
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          className="lvl-range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={question}
          aria-valuetext={`${levelLabel} (${valueText})`}
          style={{ ['--lvl-c' as string]: color, ['--lvl-fill' as string]: `${fill}%` }}
        />
        {ticks <= 12 && (
          <div className="pointer-events-none -mt-2 flex justify-between px-[13px]" aria-hidden>
            {Array.from({ length: ticks }, (_, i) => (
              <span key={i} className={`h-1.5 w-px ${min + i * step <= value ? 'bg-zinc-400' : 'bg-zinc-700'}`} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-zinc-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <p className="mt-1 text-xs leading-snug text-zinc-400">{hint}</p>
    </div>
  )
}
