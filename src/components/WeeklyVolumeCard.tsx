import { useEffect, useState } from 'react'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getMuscleGroupVolume } from '../lib/workouts'
import { VOLUME_STATUS_LABEL, VOLUME_TARGET_MAX, VOLUME_TARGET_MIN, mostNeglected, weeklyVolumeByGroup, type GroupVolume, type VolumeStatus } from '../lib/weeklyVolume'
import { findPlateaus, type TrainingAlert } from '../lib/trainingAlerts'
import { useCollapsible } from '../lib/useCollapsible'
import Collapsible from './Collapsible'

const SCALE_MAX = 24
const BAR_COLOR: Record<VolumeStatus, string> = {
  none: 'bg-zinc-700',
  low: 'bg-orange-500',
  near: 'bg-indigo-400',
  ok: 'bg-teal-400',
  high: 'bg-orange-300',
}

/** Séries de travail des 7 derniers jours par muscle, comparées au repère 10-20, + plateaux détectés. */
export default function WeeklyVolumeCard() {
  const [groups, setGroups] = useState<GroupVolume[] | null>(null)
  const [plateaus, setPlateaus] = useState<TrainingAlert[]>([])
  const [open, setOpen] = useCollapsible('gym-volume', true)

  useEffect(() => {
    getMuscleGroupVolume(7).then((stats) => setGroups(weeklyVolumeByGroup(stats)))
    findPlateaus().then(setPlateaus)
  }, [])

  if (!groups) return null
  const total = groups.reduce((s, g) => s + g.sets, 0)
  const lagging = mostNeglected(groups, 2)

  return (
    <section className="glass mb-6 rounded-2xl p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <TrendingUp size={14} className="text-teal-400" /> Volume de la semaine
        </span>
        <span className="flex items-center gap-2 text-xs text-zinc-400">
          {total} séries
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <Collapsible open={open}>
        <p className="mb-3 mt-1 text-xs text-zinc-400">
          Repère : {VOLUME_TARGET_MIN} à {VOLUME_TARGET_MAX} séries de travail par muscle et par semaine.
        </p>
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-zinc-200">{g.label}</span>
                <span className="text-zinc-400">
                  <span className="font-mono tabular-nums text-zinc-100">{g.sets}</span> · {VOLUME_STATUS_LABEL[g.status]}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-zinc-800">
                <div className={`h-full rounded-full ${BAR_COLOR[g.status]}`} style={{ width: `${Math.min(1, g.sets / SCALE_MAX) * 100}%` }} />
                <span className="absolute top-[-2px] h-3 w-px bg-zinc-500" style={{ left: `${(VOLUME_TARGET_MIN / SCALE_MAX) * 100}%` }} aria-hidden="true" />
                <span className="absolute top-[-2px] h-3 w-px bg-zinc-500" style={{ left: `${(VOLUME_TARGET_MAX / SCALE_MAX) * 100}%` }} aria-hidden="true" />
              </div>
            </li>
          ))}
        </ul>

        {total > 0 && lagging.length > 0 && (
          <p className="mt-3 rounded-lg bg-zinc-900 p-2.5 text-xs text-zinc-300">
            À travailler en priorité : <span className="font-semibold text-orange-300">{lagging.map((g) => g.label).join(', ')}</span>.
          </p>
        )}

        {plateaus.map((p) => (
          <Link key={p.id} to={p.to} className="mt-2 block rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-2.5 text-xs">
            <span className="font-semibold text-indigo-200">{p.title}</span>
            <span className="mt-0.5 block text-zinc-400">{p.detail}</span>
          </Link>
        ))}
      </Collapsible>
    </section>
  )
}
