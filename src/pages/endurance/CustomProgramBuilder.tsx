import { useState } from 'react'
import { X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { FALLBACK_NOTE, type EnduranceProgram, type PhaseIntensity, type ProgramPhase } from '../../lib/endurancePrograms'
import { ENDURANCE_ACTIVITY_META } from '../../lib/endurance'
import type { CustomEnduranceProgram } from '../../lib/customEndurancePrograms'
import ProgramProfileChart from '../../components/ProgramProfileChart'

const INTENSITY_OPTIONS: PhaseIntensity[] = ['facile', 'modéré', 'dur']
const ACTIVITY_OPTIONS: Array<Extract<EnduranceProgram['activityType'], 'tapis' | 'velo-appart'>> = ['tapis', 'velo-appart']

function blankPhase(): ProgramPhase {
  return { label: 'Nouvelle phase', durationSec: 300, intensity: 'modéré' }
}

/** Éditeur de programme coaching maison — même structure de phases que les
 * programmes intégrés (endurancePrograms.ts), pour traverser le même moteur
 * de chrono live une fois enregistré. */
export default function CustomProgramBuilder({
  initial,
  onClose,
  onSave,
}: {
  initial?: CustomEnduranceProgram
  onClose: () => void
  onSave: (program: Omit<EnduranceProgram, 'id'> & { id?: string }) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [activityType, setActivityType] = useState<EnduranceProgram['activityType']>(initial?.activityType ?? 'tapis')
  const [focus, setFocus] = useState(initial?.focus ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [difficulty, setDifficulty] = useState<PhaseIntensity>(initial?.difficulty ?? 'modéré')
  const [phases, setPhases] = useState<ProgramPhase[]>(initial?.phases ?? [blankPhase()])

  function updatePhase(i: number, patch: Partial<ProgramPhase>) {
    setPhases((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }
  function removePhase(i: number) {
    setPhases((prev) => prev.filter((_, idx) => idx !== i))
  }
  function movePhase(i: number, dir: -1 | 1) {
    setPhases((prev) => {
      const next = [...prev]
      const target = i + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[i], next[target]] = [next[target], next[i]]
      return next
    })
  }

  const totalMin = Math.round(phases.reduce((s, p) => s + p.durationSec, 0) / 60)
  const canSave = name.trim().length > 0 && phases.length > 0

  function save() {
    if (!canSave) return
    // Pour le tapis, vitesse/pente sont saisies en champs structurés (pour
    // le graphique) plutôt que dans `target` — on synthétise quand même un
    // `target` lisible pour les affichages existants (aperçu, chrono live).
    const finalPhases =
      activityType === 'tapis'
        ? phases.map((p) => ({
            ...p,
            target:
              p.speedKmh != null || p.inclineLevel != null
                ? [p.speedKmh != null ? `${p.speedKmh} km/h` : null, p.inclineLevel != null ? `pente ${p.inclineLevel}` : null].filter(Boolean).join(' · ')
                : p.target,
          }))
        : phases
    onSave({
      id: initial?.id,
      name: name.trim(),
      activityType,
      focus: focus.trim() || `Programme personnalisé, ~${totalMin} min`,
      description: description.trim() || 'Programme créé sur mesure.',
      difficulty,
      phases: finalPhases,
      fallbackNote: FALLBACK_NOTE,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{initial ? 'Modifier le programme' : 'Nouveau programme personnalisé'}</h2>
            <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
              <X size={18} />
            </button>
          </div>

          <label className="mb-1 block text-xs text-zinc-500">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Mon fractionné du jeudi"
            className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />

          <label className="mb-1 block text-xs text-zinc-500">Machine</label>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {ACTIVITY_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => setActivityType(a)}
                className={`rounded-lg px-2.5 py-2 text-xs font-medium ${
                  activityType === a ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
                }`}
              >
                {ENDURANCE_ACTIVITY_META[a].label}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs text-zinc-500">Résumé (optionnel)</label>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder={`Ex : Fractionné maison, ~${totalMin} min`}
            className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />

          <label className="mb-1 block text-xs text-zinc-500">Description (optionnel)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Ce que ce programme travaille, quand le faire..."
            className="mb-3 w-full resize-none rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />

          <label className="mb-1 block text-xs text-zinc-500">Niveau global</label>
          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {INTENSITY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg px-2.5 py-2 text-xs font-medium capitalize ${
                  difficulty === d ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-zinc-500">Phases · ~{totalMin} min au total</p>
          </div>
          {activityType === 'tapis' && <ProgramProfileChart phases={phases} />}
          <div className="mb-2 space-y-2">
            {phases.map((p, i) => (
              <div key={i} className="glass rounded-xl p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <input
                    value={p.label}
                    onChange={(e) => updatePhase(i, { label: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button onClick={() => movePhase(i, -1)} disabled={i === 0} className="rounded-full p-1 text-zinc-500 disabled:opacity-20 active:bg-zinc-900">
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => movePhase(i, 1)}
                    disabled={i === phases.length - 1}
                    className="rounded-full p-1 text-zinc-500 disabled:opacity-20 active:bg-zinc-900"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => removePhase(i)} className="rounded-full p-1 text-red-400/80 active:bg-red-500/10">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={Math.round(p.durationSec / 60)}
                    onChange={(e) => updatePhase(i, { durationSec: Math.max(1, Number(e.target.value) || 1) * 60 })}
                    className="w-16 shrink-0 rounded-lg bg-zinc-900 px-2 py-1.5 text-center text-xs outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <span className="shrink-0 text-[11px] text-zinc-600">min</span>
                  <div className="flex shrink-0 gap-1">
                    {INTENSITY_OPTIONS.map((intensity) => (
                      <button
                        key={intensity}
                        onClick={() => updatePhase(i, { intensity })}
                        className={`rounded-md px-2 py-1.5 text-[10px] font-medium capitalize ${
                          p.intensity === intensity ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'
                        }`}
                      >
                        {intensity}
                      </button>
                    ))}
                  </div>
                  {activityType !== 'tapis' && (
                    <input
                      value={p.target ?? ''}
                      onChange={(e) => updatePhase(i, { target: e.target.value || undefined })}
                      placeholder="70-80 RPM (optionnel)"
                      className="min-w-0 flex-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  )}
                </div>
                {activityType === 'tapis' && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={p.speedKmh ?? ''}
                      onChange={(e) => updatePhase(i, { speedKmh: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Vitesse"
                      className="w-20 rounded-lg bg-zinc-900 px-2 py-1.5 text-center text-[11px] outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <span className="shrink-0 text-[10px] text-zinc-600">km/h</span>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={p.inclineLevel ?? ''}
                      onChange={(e) => updatePhase(i, { inclineLevel: e.target.value ? Math.min(25, Math.max(1, Number(e.target.value))) : undefined })}
                      placeholder="Pente"
                      className="w-20 rounded-lg bg-zinc-900 px-2 py-1.5 text-center text-[11px] outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <span className="shrink-0 text-[10px] text-zinc-600">niveau (1-25)</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setPhases((prev) => [...prev, blankPhase()])}
            className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-2.5 text-xs text-zinc-400 active:bg-zinc-900"
          >
            <Plus size={14} /> Ajouter une phase
          </button>
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={save}
            disabled={!canSave}
            className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400 disabled:opacity-40"
          >
            {initial ? 'Enregistrer les modifications' : 'Créer le programme'}
          </button>
        </div>
      </div>
    </div>
  )
}
