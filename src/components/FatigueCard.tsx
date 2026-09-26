import { useEffect, useState } from 'react'
import { FATIGUE_LABEL, getFatigue, saveFatigue } from '../lib/fatigue'
import type { DailyFatigue } from '../types'

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-sm font-medium text-zinc-200">{label}</label>
        <span className="text-xs font-semibold text-orange-300">{FATIGUE_LABEL[value]}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={FATIGUE_LABEL[value]}
        className="h-11 w-full cursor-pointer accent-orange-500"
      />
    </div>
  )
}

/** Deux curseurs 1-5 (fatigue générale / musculaire) du jour, enregistrés à chaque changement. */
export default function FatigueCard({ date, onChange }: { date: string; onChange?: (f: DailyFatigue) => void }) {
  const [general, setGeneral] = useState(3)
  const [muscular, setMuscular] = useState(3)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    let alive = true
    getFatigue(date).then((f) => {
      if (!alive) return
      setGeneral(f?.general ?? 3)
      setMuscular(f?.muscular ?? 3)
      setTouched(f != null)
      if (f) onChange?.(f)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  async function update(patch: { general?: number; muscular?: number }) {
    if (patch.general != null) setGeneral(patch.general)
    if (patch.muscular != null) setMuscular(patch.muscular)
    setTouched(true)
    onChange?.(await saveFatigue(date, patch))
  }

  return (
    <section className="glass space-y-1 rounded-3xl p-4" aria-label="Fatigue du jour">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Fatigue du jour</h2>
        {!touched && <span className="text-[11px] text-zinc-400">Bouge un curseur pour enregistrer</span>}
      </div>
      <Slider label="Générale" value={general} onChange={(v) => update({ general: v })} />
      <Slider label="Musculaire" value={muscular} onChange={(v) => update({ muscular: v })} />
    </section>
  )
}
