import { useEffect, useRef, useState } from 'react'
import { BatteryLow, Check, ClipboardCheck, Dumbbell, Moon, Pencil, Zap } from 'lucide-react'
import LevelSlider from './LevelSlider'
import {
  GENERAL_FATIGUE_LEVELS,
  MOTIVATION_LEVELS,
  MUSCLE_FATIGUE_LEVELS,
  levelColor,
  levelFor,
  loadCheckinDraft,
  saveCheckin,
  sleepLevel,
  type CheckinDraft,
} from '../lib/checkin'
import { getSettings } from '../lib/settings'
import { todayStr } from '../lib/date'
import type { RecoveryCheckin } from '../types'

function hoursLabel(h: number): string {
  const total = Math.round(h * 60)
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`
}

/**
 * Check-in du jour, identique sur l'Accueil et en Récup : 4 curseurs pré-remplis
 * (sommeil depuis Google Fit), enregistrés au fil de l'eau — pas de bouton
 * "Valider" obligatoire. Une fois fait, se replie en une ligne de résumé.
 */
export default function DailyCheckinCard({
  onChange,
}: {
  /** Appelé au chargement et à chaque modification (pour un score affiché en direct). */
  onChange?: (draft: CheckinDraft, saved: RecoveryCheckin | null) => void
}) {
  const date = todayStr()
  const settings = getSettings()
  const [draft, setDraft] = useState<CheckinDraft | null>(null)
  const [saved, setSaved] = useState<RecoveryCheckin | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [flash, setFlash] = useState(false)
  const timer = useRef<number | null>(null)
  const pending = useRef<CheckinDraft | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    let alive = true
    loadCheckinDraft(date).then(({ draft: d, saved: s }) => {
      if (!alive) return
      setDraft(d)
      setSaved(s)
      setExpanded(!s)
      onChangeRef.current?.(d, s)
    })
    return () => {
      alive = false
    }
  }, [date])

  async function persist(d: CheckinDraft) {
    pending.current = null
    const s = await saveCheckin(date, d, settings)
    setSaved(s)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 1200)
    onChangeRef.current?.(d, s)
  }

  // Enregistre ce qui reste en attente si on quitte la page pendant le délai.
  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
      if (pending.current) void saveCheckin(date, pending.current, settings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(patch: Partial<CheckinDraft>) {
    if (!draft) return
    const next = { ...draft, ...patch }
    setDraft(next)
    onChangeRef.current?.(next, saved)
    pending.current = next
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void persist(next), 500)
  }

  async function done() {
    if (!draft) return
    if (timer.current != null) window.clearTimeout(timer.current)
    await persist(draft)
    setExpanded(false)
  }

  if (!draft) return <section className="glass h-24 animate-pulse rounded-3xl" aria-label="Check-in du jour" />

  const general = levelFor(GENERAL_FATIGUE_LEVELS, draft.generalFatigue)
  const muscle = levelFor(MUSCLE_FATIGUE_LEVELS, draft.muscleFatigue)
  const motivation = levelFor(MOTIVATION_LEVELS, draft.motivation)
  const sleep = sleepLevel(draft.sleepHours, settings.sleepTargetMin)
  const sleepRatio = (draft.sleepHours * 60) / settings.sleepTargetMin
  const sleepColor = levelColor(sleepRatio >= 0.95 ? 0 : sleepRatio >= 0.85 ? 0.25 : sleepRatio >= 0.7 ? 0.75 : 1)
  const generalColor = levelColor((draft.generalFatigue - 1) / 9)
  const muscleColor = levelColor((draft.muscleFatigue - 1) / 9)
  const motivationColor = levelColor((5 - draft.motivation) / 4)

  if (saved && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="glass flex w-full items-center gap-3 rounded-3xl p-3.5 text-left active:scale-[0.99] transition-transform"
        aria-label="Modifier le check-in du jour"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
          <ClipboardCheck size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            Check-in du jour <Check size={14} className="text-teal-300" />
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-zinc-400">
            <span style={{ color: sleepColor }}>Sommeil {hoursLabel(draft.sleepHours)}</span>
            <span style={{ color: generalColor }}>Fatigue {general.label.toLowerCase()}</span>
            <span style={{ color: muscleColor }}>Muscles {muscle.label.toLowerCase()}</span>
            <span style={{ color: motivationColor }}>Motivation {motivation.label.toLowerCase()}</span>
          </span>
        </span>
        <Pencil size={15} className="shrink-0 text-zinc-500" />
      </button>
    )
  }

  return (
    <section className="glass space-y-4 rounded-3xl p-4" aria-label="Check-in du jour">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <ClipboardCheck size={16} className="text-teal-300" /> Check-in du jour
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">10 secondes · enregistré au fur et à mesure</p>
        </div>
        <span className={`flex items-center gap-1 text-[11px] text-teal-300 transition-opacity ${flash ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
          <Check size={12} /> Enregistré
        </span>
      </div>

      <LevelSlider
        icon={<Moon size={16} />}
        question="Sommeil cette nuit"
        value={draft.sleepHours}
        min={3}
        max={12}
        step={0.25}
        levelLabel={sleep.label}
        valueText={hoursLabel(draft.sleepHours)}
        hint={draft.sleepSource === 'googlefit' ? `${sleep.hint} Récupéré de Google Fit — ajuste si besoin.` : sleep.hint}
        color={sleepColor}
        minLabel="3 h"
        maxLabel="12 h"
        badge={
          draft.sleepSource === 'googlefit' ? (
            <span className="shrink-0 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-300">Google Fit</span>
          ) : null
        }
        onChange={(v) => update({ sleepHours: v, sleepSource: 'manual' })}
      />
      <LevelSlider
        icon={<BatteryLow size={16} />}
        question="Fatigue générale"
        value={draft.generalFatigue}
        min={1}
        max={10}
        levelLabel={general.label}
        valueText={`${draft.generalFatigue}/10`}
        hint={general.hint}
        color={generalColor}
        minLabel="En forme"
        maxLabel="Épuisé"
        onChange={(v) => update({ generalFatigue: v })}
      />
      <LevelSlider
        icon={<Dumbbell size={16} />}
        question="Fatigue musculaire"
        value={draft.muscleFatigue}
        min={1}
        max={10}
        levelLabel={muscle.label}
        valueText={`${draft.muscleFatigue}/10`}
        hint={muscle.hint}
        color={muscleColor}
        minLabel="Frais"
        maxLabel="Courbaturé"
        onChange={(v) => update({ muscleFatigue: v })}
      />
      <LevelSlider
        icon={<Zap size={16} />}
        question="Motivation"
        value={draft.motivation}
        min={1}
        max={5}
        levelLabel={motivation.label}
        valueText={`${draft.motivation}/5`}
        hint={motivation.hint}
        color={motivationColor}
        minLabel="Aucune envie"
        maxLabel="À fond"
        onChange={(v) => update({ motivation: v })}
      />

      <button
        onClick={done}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
      >
        <Check size={16} /> {saved ? "C'est à jour" : "C'est bon"}
      </button>
    </section>
  )
}
