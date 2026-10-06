import { useMemo, useState } from 'react'
import { Check, Footprints, Minus, Plus, X } from 'lucide-react'
import { NORMAL_DAY_ID, WALK_CATEGORIES, allocateWalk, allocationLogsFor, computeAllocation, currentShares, evenShares, type WalkShares } from '../lib/walkAllocation'
import { isSynthetic } from '../lib/enduranceMerge'
import { formatDate } from '../lib/date'
import { getSettings } from '../lib/settings'
import type { ActivityLog, EnduranceSession } from '../types'

const SEGMENT_COLORS = ['#ff5a30', '#4a63d8', '#7b6be6', '#ff9466', '#e2361c', '#7d93ea', '#5b3fc4', '#ffb08a', '#2f4bd6']

/**
 * "À quoi correspondait cette marche ?" — touche une ou plusieurs catégories pour
 * répartir à parts égales (2 → 50/50), ajuste par ±10 %, le reste reste de la
 * marche ("journée normale"). Rouvrable : la répartition se remplace.
 */
export default function WalkAllocationSheet({
  walk,
  logs,
  steps,
  onClose,
  onSaved,
  saveLabel = 'Enregistrer',
}: {
  walk: EnduranceSession
  logs: ActivityLog[]
  steps?: number
  onClose: () => void
  onSaved: () => void
  saveLabel?: string
}) {
  const [shares, setShares] = useState<WalkShares>(() => currentShares(walk, logs))
  const [saving, setSaving] = useState(false)
  const baseMin = walk.durationMin + allocationLogsFor(walk.id, logs).reduce((s, l) => s + l.durationMin, 0)
  const selected = WALK_CATEGORIES.filter((c) => (shares[c.id] ?? 0) > 0).map((c) => c.id)
  const allocatedPct = Object.values(shares).reduce((s, n) => s + n, 0)
  const normalPct = Math.max(0, 100 - allocatedPct)
  const { minutesById, normalMin } = useMemo(() => computeAllocation(baseMin, shares), [baseMin, shares])

  function toggle(id: string) {
    const ids = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    setShares(evenShares(ids))
  }

  function nudge(id: string, delta: number) {
    setShares((prev) => {
      const current = prev[id] ?? 0
      const others = allocatedPct - current
      const next = Math.max(0, Math.min(100 - others, current + delta))
      return { ...prev, [id]: next }
    })
  }

  async function save() {
    setSaving(true)
    try {
      await allocateWalk(walk.id, Object.fromEntries(Object.entries(shares).filter(([, v]) => v > 0)), getSettings())
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="mesh-backdrop flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">À quoi correspondait cette marche ?</h2>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                <Footprints size={12} className="text-teal-400" />
                {isSynthetic(walk) ? 'Pas du quotidien' : 'Marche'} · {formatDate(walk.startedAt)} · {baseMin} min
                {steps != null && ` · ${steps.toLocaleString('fr-FR')} pas`}
              </p>
            </div>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Touche une ou plusieurs activités : le temps est réparti à parts égales, ajuste ensuite. Le reste reste de la marche.</p>

          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
            {WALK_CATEGORIES.map((c, i) =>
              (shares[c.id] ?? 0) > 0 ? <div key={c.id} style={{ width: `${shares[c.id]}%`, backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} /> : null,
            )}
            {normalPct > 0 && <div style={{ width: `${normalPct}%` }} className="bg-zinc-600" />}
          </div>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-2">
          <button
            onClick={() => setShares({})}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${normalPct === 100 ? 'bg-zinc-800 ring-1 ring-zinc-500' : 'bg-zinc-900'}`}
            aria-pressed={normalPct === 100}
            data-id={NORMAL_DAY_ID}
          >
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
              Journée normale (déplacements)
            </span>
            <span className="text-xs tabular-nums text-zinc-400">
              {normalPct} % · {normalMin} min
            </span>
          </button>

          {WALK_CATEGORIES.map((c, i) => {
            const pct = shares[c.id] ?? 0
            const on = pct > 0
            return (
              <div key={c.id} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${on ? 'bg-zinc-800' : 'bg-zinc-900'}`}>
                <button onClick={() => toggle(c.id)} className="flex min-h-9 flex-1 items-center gap-2 text-left text-sm" aria-pressed={on}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: on ? SEGMENT_COLORS[i % SEGMENT_COLORS.length] : '#3f3f46' }} />
                  <span className={on ? 'font-medium text-white' : 'text-zinc-300'}>{c.label}</span>
                </button>
                {on && (
                  <span className="flex shrink-0 items-center gap-1">
                    <button onClick={() => nudge(c.id, -10)} className="rounded-lg bg-zinc-900 p-2 active:bg-zinc-700" aria-label={`Moins de ${c.label}`}>
                      <Minus size={13} />
                    </button>
                    <span className="w-16 text-center text-xs tabular-nums text-zinc-200">
                      {pct} % · {minutesById[c.id] ?? 0}′
                    </span>
                    <button onClick={() => nudge(c.id, 10)} disabled={normalPct === 0} className="rounded-lg bg-zinc-900 p-2 active:bg-zinc-700 disabled:opacity-30" aria-label={`Plus de ${c.label}`}>
                      <Plus size={13} />
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400 disabled:opacity-60"
          >
            <Check size={16} /> {selected.length === 0 ? "C'était bien de la marche" : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
