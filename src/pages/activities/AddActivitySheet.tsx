import { useMemo, useState } from 'react'
import { Activity, ChevronRight, Search, Trash2, X } from 'lucide-react'
import { MET_ACTIVITIES, computeCaloriesForUser } from '../../lib/met'
import { getSettings } from '../../lib/settings'
import { formatTime } from '../../lib/date'
import { ACTIVITY_PHOTOS } from '../../lib/activityPhotos'
import { ENDURANCE_ACTIVITY_META, MET_TO_ENDURANCE } from '../../lib/endurance'
import type { ActivityCategory, ActivityLog, EnduranceActivityType } from '../../types'

const CATEGORY_SECTION_LABEL: Partial<Record<ActivityCategory, string>> = {
  outdoor: 'Sport',
  loisir: 'Loisirs',
  quotidien: 'Quotidien',
  bureau: 'Au bureau',
  deplacement: 'Déplacement pro',
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/**
 * "Qu'as-tu fait ?" — un seul point d'entrée pour tout ce qui bouge : une sortie
 * (marche, course, vélo… → formulaire de sortie avec distance, GPS, scan machine)
 * ou une activité du quotidien/loisir (durée → enregistrée tout de suite).
 */
export function AddActivitySheet({
  onPickEndurance,
  onSubmitActivity,
  onClose,
  filterIds,
  preferredTypes = [],
}: {
  onPickEndurance: (type: EnduranceActivityType) => void
  onSubmitActivity: (entry: Omit<ActivityLog, 'id' | 'loggedAt'>, metId: string) => void
  onClose: () => void
  /** Sélection restreinte (raccourcis de la page Ajouter) : masque les sorties. */
  filterIds?: string[]
  /** Types de sortie pratiqués récemment, proposés en premier. */
  preferredTypes?: EnduranceActivityType[]
}) {
  const [query, setQuery] = useState('')
  const [activityId, setActivityId] = useState<string | null>(filterIds?.length === 1 ? filterIds[0] : null)
  const [duration, setDuration] = useState('30')
  const settings = getSettings()
  const q = normalize(query.trim())

  // Les sports qui ont leur propre type de sortie sont proposés en haut, pas en double dans la liste.
  const options = useMemo(
    () =>
      (filterIds ? MET_ACTIVITIES.filter((a) => filterIds.includes(a.id)) : MET_ACTIVITIES.filter((a) => !MET_TO_ENDURANCE[a.id])).filter(
        (a) => !q || normalize(a.label).includes(q),
      ),
    [filterIds, q],
  )
  const allTypes = Object.keys(ENDURANCE_ACTIVITY_META) as EnduranceActivityType[]
  const enduranceTypes = [...preferredTypes.filter((t) => allTypes.includes(t)), ...allTypes.filter((t) => !preferredTypes.includes(t))].filter(
    (t) => !q || normalize(ENDURANCE_ACTIVITY_META[t].label).includes(q),
  )
  const sections = (['loisir', 'quotidien', 'outdoor', 'bureau', 'deplacement'] as ActivityCategory[])
    .map((cat) => ({ cat, items: options.filter((a) => a.category === cat) }))
    .filter((s) => s.items.length > 0)
  const activity = MET_ACTIVITIES.find((a) => a.id === activityId) ?? null
  const durationMin = parseInt(duration || '0', 10)

  function submit() {
    if (!activity || !durationMin) return
    onSubmitActivity(
      {
        category: activity.category,
        label: activity.label,
        metValue: activity.met,
        durationMin,
        caloriesBurned: computeCaloriesForUser(activity.met, durationMin, settings),
      },
      activity.id,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-4 pb-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Qu'as-tu fait ?</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2.5">
            <Search size={15} className="shrink-0 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher : vélo, jardinage, yoga…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {!filterIds && enduranceTypes.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Sortie sportive</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {enduranceTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => onPickEndurance(t)}
                    className="glass flex items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium active:scale-[0.98] transition-transform"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Activity size={15} className="shrink-0 text-teal-400" />
                      <span className="leading-tight">{ENDURANCE_ACTIVITY_META[t].label}</span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-zinc-600" />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500">Distance, GPS en direct, scan machine — fusionnée avec ta montre si elle l'a déjà.</p>
            </div>
          )}

          {sections.map(({ cat, items }) => (
            <div key={cat} className="mb-4">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">{CATEGORY_SECTION_LABEL[cat]}</h3>
              <ul className="grid grid-cols-2 gap-1.5">
                {items.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setActivityId(a.id)}
                      aria-pressed={a.id === activityId}
                      className={`glass flex h-full w-full items-center gap-2 rounded-xl p-2 text-left ${a.id === activityId ? 'ring-2 ring-teal-500' : ''}`}
                    >
                      {ACTIVITY_PHOTOS[a.id] ? (
                        <img src={ACTIVITY_PHOTOS[a.id]} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-lg bg-zinc-900" />
                      )}
                      <span className={`text-xs leading-tight ${a.id === activityId ? 'font-semibold text-teal-300' : 'text-zinc-200'}`}>{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {sections.length === 0 && enduranceTypes.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Rien ne correspond à « {query} ».</p>}
        </div>

        {activity && (
          <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            <div className="mb-3 flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{activity.label}</span>
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setDuration(String(m))}
                  className={`rounded-lg px-2.5 py-2 text-xs font-medium ${duration === String(m) ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}
                >
                  {m}
                </button>
              ))}
              <div className="relative w-20">
                <input
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  aria-label="Durée en minutes"
                  className="w-full rounded-lg bg-zinc-900 py-2 pl-2 pr-8 text-center text-sm outline-none focus:ring-1 focus:ring-teal-500"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">min</span>
              </div>
            </div>
            <button
              onClick={submit}
              disabled={!durationMin}
              className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400 disabled:opacity-50"
            >
              Enregistrer · ≈ {computeCaloriesForUser(activity.met, durationMin || 0, settings)} kcal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ActivityLogRow({ log, onDelete }: { log: ActivityLog; onDelete: (id: string) => void }) {
  const activityId = MET_ACTIVITIES.find((a) => a.label === log.label)?.id
  return (
    <li className="glass flex items-center justify-between rounded-xl p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {activityId && ACTIVITY_PHOTOS[activityId] ? (
          <img src={ACTIVITY_PHOTOS[activityId]} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-lg bg-zinc-900" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{log.label}</p>
          <p className="text-xs text-zinc-500">
            {log.fromWalkId ? 'Part de marche' : formatTime(log.loggedAt)} · {log.durationMin} min
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="text-sm font-semibold text-orange-400">{log.caloriesBurned} kcal</p>
        <button
          onClick={() => onDelete(log.id)}
          className="shrink-0 rounded-full p-1 text-zinc-600 active:bg-red-500/10 active:text-red-400"
          aria-label="Supprimer l'activité"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}
