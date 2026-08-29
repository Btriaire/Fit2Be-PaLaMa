import { READINESS_OPTIONS, TIME_BUDGET_OPTIONS, type Readiness, type TimeBudget } from '../lib/coachingFilter'

/** Les deux questions posées avant de proposer une liste de programmes
 * coaching — partagées par Gym et Endurance pour un comportement identique. */
export default function CoachingQuestions({
  readiness,
  onReadiness,
  timeBudget,
  onTimeBudget,
  accentClass,
}: {
  readiness: Readiness | null
  onReadiness: (r: Readiness) => void
  timeBudget: TimeBudget | null
  onTimeBudget: (t: TimeBudget) => void
  /** Couleur d'accent Tailwind pour le chip sélectionné (garde la palette propre à chaque page). */
  accentClass: string
}) {
  return (
    <div className="mb-3 space-y-2.5">
      <div>
        <p className="mb-1.5 text-[11px] text-zinc-500">Comment tu te sens aujourd'hui ?</p>
        <div className="flex gap-1.5">
          {READINESS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onReadiness(o.value)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium ${
                readiness === o.value ? `${accentClass} text-zinc-950` : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] text-zinc-500">Tu as combien de temps ?</p>
        <div className="flex gap-1.5">
          {TIME_BUDGET_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onTimeBudget(o.value)}
              className={`flex-1 rounded-lg py-2 text-[11px] font-medium ${
                timeBudget === o.value ? `${accentClass} text-zinc-950` : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
