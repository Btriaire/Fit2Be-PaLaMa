import { Flame, X } from 'lucide-react'
import { ENDURANCE_ACTIVITY_META } from '../../lib/endurance'
import { type EnduranceProgram } from '../../lib/endurancePrograms'
import ProgramProfileChart from '../../components/ProgramProfileChart'
import { INTENSITY_COLOR, programTotalSec, formatPhaseDuration } from './enduranceShared'
import { IntervalProfile } from './IntervalProfile'

export function ProgramPreview({
  program,
  onClose,
  onStart,
  onEdit,
  onDelete,
}: {
  program: EnduranceProgram
  onClose: () => void
  onStart: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const meta = ENDURANCE_ACTIVITY_META[program.activityType]
  const totalMin = Math.round(programTotalSec(program) / 60)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">{program.name}</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-orange-400">
            {meta.label} · {totalMin} min
          </p>
          <p className="mb-3 text-sm text-zinc-400">{program.description}</p>

          {program.phases.length > 1 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] text-zinc-600">Fractionnement</p>
              <IntervalProfile program={program} elapsedSec={0} currentIndex={-1} showCursor={false} />
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-600">
                {(['facile', 'modéré', 'dur'] as const).map((i) => (
                  <span key={i} className="flex items-center gap-1 capitalize">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: INTENSITY_COLOR[i] }} /> {i}
                  </span>
                ))}
              </div>
            </div>
          )}

          {program.activityType === 'tapis' && <ProgramProfileChart phases={program.phases} />}

          <p className="mb-2 text-[11px] text-zinc-600">Déroulé</p>
          <ul className="mb-3 space-y-1.5">
            {program.phases.map((p, i) => (
              <li key={i} className="glass rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: INTENSITY_COLOR[p.intensity] }} />
                    {p.label}
                  </span>
                  <span className="font-mono text-zinc-500">{formatPhaseDuration(p.durationSec)}</span>
                </div>
                {p.target && <p className="mt-0.5 pl-4 text-[11px] text-zinc-500">{p.target}</p>}
              </li>
            ))}
          </ul>

          <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">{program.fallbackNote}</p>
          </div>

          {program.muscuAddOn && (
            <div className="mb-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-400">
                <Flame size={13} /> {program.muscuAddOn.label}
              </p>
              <p className="text-xs leading-relaxed text-zinc-400">{program.muscuAddOn.description}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          {(onEdit || onDelete) && (
            <div className="mb-2 flex gap-2">
              {onEdit && (
                <button onClick={onEdit} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-xs font-medium text-zinc-300 active:bg-zinc-900">
                  Modifier
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} className="flex-1 rounded-xl border border-red-500/30 py-2.5 text-xs font-medium text-red-400 active:bg-red-500/10">
                  Supprimer
                </button>
              )}
            </div>
          )}
          <button onClick={onStart} className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400">
            Démarrer
          </button>
        </div>
      </div>
    </div>
  )
}
