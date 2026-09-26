import { Beef, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { assessGoal, proteinTarget, type GoalStatus } from '../lib/goals'
import type { Settings } from '../lib/settings'
import type { WeightLog } from '../types'

const GOAL_LABEL: Record<Settings['goal'], string> = { perte: 'perte de poids', maintien: 'maintien', prise: 'prise de muscle' }
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export function ProteinCard({ consumedG, settings }: { consumedG: number; settings: Settings }) {
  const t = proteinTarget(settings)
  const pct = Math.min(100, Math.round((consumedG / t.targetG) * 100))
  const minPct = Math.round((t.minG / t.targetG) * 100)
  const left = Math.max(0, t.targetG - Math.round(consumedG))

  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <Beef size={14} className="text-orange-400" /> Protéines
        </p>
        <p className="text-xs text-zinc-400">
          {fmt(t.perKg)} g/kg · {GOAL_LABEL[settings.goal]}
        </p>
      </div>
      <p className="mb-2 text-2xl font-bold text-zinc-50">
        {Math.round(consumedG)} <span className="text-sm font-medium text-zinc-400">/ {t.targetG} g</span>
      </p>
      <div className="relative h-2 rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
        {minPct < 100 && <span className="absolute top-[-2px] h-3 w-px bg-zinc-400" style={{ left: `${minPct}%` }} aria-hidden="true" />}
      </div>
      <p className="mt-1.5 text-xs text-zinc-400">
        {left > 0 ? `Encore ${left} g pour ton objectif` : 'Objectif atteint'} · plancher {t.minG} g (1,6 g/kg)
      </p>
    </div>
  )
}

const STATUS_STYLE: Record<GoalStatus, string> = {
  reached: 'text-teal-300',
  'on-track': 'text-teal-300',
  'no-data': 'text-zinc-300',
  'too-slow': 'text-orange-300',
  'too-fast': 'text-orange-300',
  'wrong-direction': 'text-orange-300',
}

export function GoalCard({ settings, weightLogs }: { settings: Settings; weightLogs: WeightLog[] }) {
  const a = assessGoal(settings, weightLogs)
  if (!a) {
    return (
      <Link to="/settings" className="glass mb-4 flex items-center gap-3 rounded-2xl p-4 active:bg-zinc-900/80">
        <Target size={18} className="text-teal-300" />
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-200">Fixe un objectif de poids</p>
          <p className="text-xs text-zinc-400">Poids cible et date : l&apos;app suit ton rythme et t&apos;alerte s&apos;il est irréaliste.</p>
        </div>
      </Link>
    )
  }

  const date = a.projectedDate ? new Date(`${a.projectedDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : null
  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <Target size={14} className="text-teal-300" /> Objectif de poids
        </p>
        <p className="text-xs text-zinc-400">{a.progressPct} %</p>
      </div>
      <p className="mb-2 text-2xl font-bold text-zinc-50">
        {fmt(a.currentKg)} <span className="text-sm font-medium text-zinc-400">→ {fmt(a.targetKg)} kg</span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-teal-400" style={{ width: `${a.progressPct}%` }} />
      </div>
      <p className={`mt-2 text-xs leading-snug ${STATUS_STYLE[a.status]}`}>{a.message}</p>
      {date && a.status !== 'reached' && <p className="mt-1 text-xs text-zinc-400">À ce rythme : autour du {date}.</p>}
    </div>
  )
}
