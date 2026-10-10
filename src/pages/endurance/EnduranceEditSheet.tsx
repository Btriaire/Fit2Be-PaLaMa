import { useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { ENDURANCE_ACTIVITY_META, estimateEnduranceCalories, updateEnduranceSession } from '../../lib/endurance'
import { ENDURANCE_PROGRAMS } from '../../lib/endurancePrograms'
import { HR_ZONE_META } from '../../lib/heartRate'
import { getSettings } from '../../lib/settings'
import { todayStr } from '../../lib/date'
import type { EnduranceActivityType, EnduranceSession, HrZone } from '../../types'

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const toTimeInput = (ts: number) => {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const num = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Corriger une sortie après coup : type, date et heure, durée, distance, FC, calories, ressenti, notes. */
export default function EnduranceEditSheet({
  session,
  onClose,
  onSaved,
}: {
  session: EnduranceSession
  onClose: () => void
  onSaved: (s: EnduranceSession) => void
}) {
  const settings = getSettings()
  const [type, setType] = useState<EnduranceActivityType>(session.activityType)
  const [date, setDate] = useState(toDateInput(session.startedAt))
  const [time, setTime] = useState(toTimeInput(session.startedAt))
  const [duration, setDuration] = useState(String(session.durationMin))
  const [distance, setDistance] = useState(session.distanceKm != null ? String(session.distanceKm) : '')
  const [hr, setHr] = useState(session.avgHeartRate != null ? String(session.avgHeartRate) : '')
  const [kcal, setKcal] = useState(String(session.caloriesBurned))
  const [rpe, setRpe] = useState<number | null>(session.rpe ?? null)
  const [notes, setNotes] = useState(session.notes ?? '')
  // Zone : auto (d'après la FC moyenne) tant qu'on ne la choisit pas. Une séance par intervalles
  // a une FC moyenne basse (les récupérations la tirent vers le bas) : on peut la corriger.
  const [zone, setZone] = useState<HrZone | null>(session.hrZone ?? null)
  const [zoneManual, setZoneManual] = useState(false)
  const [programId, setProgramId] = useState<string | null>(session.programId ?? null)
  const programs = ENDURANCE_PROGRAMS.filter((p) => p.activityType === type)
  const [saving, setSaving] = useState(false)
  const meta = ENDURANCE_ACTIVITY_META[type]
  const durationMin = Math.round(num(duration) ?? 0)

  function recompute() {
    if (!durationMin) return
    setKcal(String(estimateEnduranceCalories({ activityType: type, durationMin, avgHeartRate: num(hr) ? Math.round(num(hr)!) : undefined }, settings)))
  }

  async function save() {
    if (!durationMin) return
    setSaving(true)
    try {
      const updated = await updateEnduranceSession(
        session.id,
        {
          activityType: type,
          startedAt: new Date(`${date}T${time || '12:00'}:00`).getTime(),
          durationMin,
          distanceKm: meta.hasDistance ? num(distance) : session.distanceKm,
          avgHeartRate: num(hr) ? Math.round(num(hr)!) : undefined,
          caloriesBurned: Math.round(num(kcal) ?? 0),
          rpe: rpe ?? undefined,
          notes,
          hrZone: zoneManual ? (zone ?? undefined) : undefined,
          programId: programId ?? undefined,
        },
        settings,
      )
      if (updated) onSaved(updated)
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-teal-500'
  const label = 'mb-1 block text-xs text-zinc-500'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="mesh-backdrop flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between p-4 pb-2">
          <h2 className="font-semibold">Modifier la sortie</h2>
          <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-2">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Type">
            {(Object.keys(ENDURANCE_ACTIVITY_META) as EnduranceActivityType[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={k === type}
                onClick={() => setType(k)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium ${k === type ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}
              >
                {ENDURANCE_ACTIVITY_META[k].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Date</label>
              <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Heure de début</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={label}>Durée (min)</label>
              <input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Distance (km)</label>
              <input
                inputMode="decimal"
                value={distance}
                disabled={!meta.hasDistance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder={meta.hasDistance ? '—' : 'n/a'}
                className={`${field} disabled:opacity-40`}
              />
            </div>
            <div>
              <label className={label}>FC moy.</label>
              <input inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="—" className={field} />
            </div>
          </div>

          <div>
            <label className={label}>Calories</label>
            <div className="flex gap-2">
              <input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className={field} />
              <button
                onClick={recompute}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-teal-300 active:bg-zinc-800"
                title="Recalculer depuis la durée, la FC et le type"
              >
                <RotateCcw size={13} /> Recalculer
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Garde la valeur de la machine ou de la montre si tu l'as ; « Recalculer » estime depuis durée + FC.</p>
          </div>

          <div>
            <label className={label}>Ressenti (difficulté) {rpe != null && <span className="text-zinc-300">· {rpe}/10</span>}</label>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setRpe(rpe === n ? null : n)}
                  className={`rounded-md py-2 text-xs font-semibold ${rpe === n ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'}`}
                  aria-pressed={rpe === n}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>Zone de FC {zoneManual ? '(choisie)' : '(auto, d’après la FC moyenne)'}</label>
            <div className="grid grid-cols-5 gap-1">
              {([1, 2, 3, 4, 5] as HrZone[]).map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setZone(z)
                    setZoneManual(true)
                  }}
                  aria-pressed={zoneManual && zone === z}
                  className={`rounded-md py-2 text-xs font-semibold ${zoneManual && zone === z ? 'text-zinc-950' : 'bg-zinc-900 text-zinc-400'}`}
                  style={zoneManual && zone === z ? { backgroundColor: HR_ZONE_META[z].color } : undefined}
                >
                  Z{z}
                </button>
              ))}
            </div>
            {zoneManual && (
              <button onClick={() => setZoneManual(false)} className="mt-1 text-[11px] text-teal-300">
                Revenir au calcul automatique
              </button>
            )}
          </div>

          {programs.length > 0 && (
            <div>
              <label className={label}>Programme suivi</label>
              <select
                value={programId ?? ''}
                onChange={(e) => setProgramId(e.target.value || null)}
                className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Aucun (séance libre)</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          {session.externalId && <p className="text-[11px] text-zinc-500">Importée de ta montre : tes corrections ne seront plus écrasées par la synchro.</p>}
        </div>

        <div className="shrink-0 border-t border-zinc-800 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button
            onClick={save}
            disabled={saving || !durationMin}
            className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400 disabled:opacity-50"
          >
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  )
}
