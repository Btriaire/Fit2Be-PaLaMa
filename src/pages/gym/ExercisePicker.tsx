import { useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { estimateExerciseDurationMin } from '../../lib/workouts'
import { ALL_EXERCISES, MUSCLE_GROUPS } from '../../lib/exercises'
import { getSettings } from '../../lib/settings'
import { useCollapsible } from '../../lib/useCollapsible'
import MuscleBodyMap from '../../components/MuscleBodyMap'
import Collapsible from '../../components/Collapsible'

export function ExercisePicker({
  onPick,
  onClose,
  exclude,
}: {
  onPick: (id: string) => void
  onClose: () => void
  exclude: string[]
}) {
  const [q, setQ] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
  const [bodyMapOpen, setBodyMapOpen] = useCollapsible('gym-picker-bodymap')
  const DISPLAY_LIMIT = 60
  const estimatedMin = estimateExerciseDurationMin(getSettings().restTimerDefaultSec)

  const filtered = ALL_EXERCISES.filter(
    (e) =>
      !exclude.includes(e.id) &&
      e.name.toLowerCase().includes(q.toLowerCase()) &&
      (!muscleFilter || e.muscleGroup === muscleFilter),
  )
  // Les machines guidées en premier — trajectoire fixe, plus accessible et
  // plus sûr techniquement, donc le choix par défaut le plus pertinent à
  // proposer en tête (tri stable : ne change pas l'ordre entre elles ni
  // entre les autres équipements).
  const sorted = [...filtered].sort((a, b) => (a.equipment === 'Machine' ? 0 : 1) - (b.equipment === 'Machine' ? 0 : 1))
  const results = sorted.slice(0, DISPLAY_LIMIT)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop flex max-h-[75vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête + filtres hors de la zone qui défile : mesh-backdrop pose
            overflow:hidden pour clipper son fond dégradé décoratif, ce qui
            écrasait overflow-y-auto quand les deux étaient sur le même
            élément (Tailwind v4 charge ses utilitaires dans un @layer, donc
            n'importe quelle règle CSS normale comme .mesh-backdrop passe
            devant) — plus aucun scroll possible dans la liste en dessous. */}
        <div className="shrink-0 p-4 pb-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Choisir un exercice</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2">
            <Search size={16} className="text-zinc-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher parmi 675+ exercices…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setBodyMapOpen((v) => !v)}
            className="mb-2 flex w-full items-center justify-between text-xs font-medium text-zinc-500"
          >
            <span>Filtrer par silhouette{muscleFilter ? ` — ${muscleFilter}` : ''}</span>
            <ChevronDown size={14} className={`text-zinc-600 transition-transform ${bodyMapOpen ? 'rotate-180' : ''}`} />
          </button>
          <Collapsible open={bodyMapOpen}>
            <div className="pb-1">
              <MuscleBodyMap selected={muscleFilter} onSelect={setMuscleFilter} />
            </div>
          </Collapsible>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setMuscleFilter(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                muscleFilter === null ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              Tous
            </button>
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                onClick={() => setMuscleFilter(m === muscleFilter ? null : m)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  muscleFilter === m ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ul className="space-y-1 pb-2">
            {results.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onPick(e.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left active:bg-zinc-900"
                >
                  {e.images?.[0] ? (
                    <img src={e.images[0]} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl bg-zinc-900 object-cover" />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-xl bg-zinc-900" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="text-xs text-zinc-500">
                      {e.muscleGroup} · {e.equipment} · ~{estimatedMin}min
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {results.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">Aucun résultat.</p>}
          </ul>
          {filtered.length > DISPLAY_LIMIT && (
            <p className="pb-4 text-center text-xs text-zinc-600">
              {filtered.length - DISPLAY_LIMIT} exercices supplémentaires — affine ta recherche pour les voir.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

