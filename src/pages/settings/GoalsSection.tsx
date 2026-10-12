import { useState } from 'react'
import { HR_ZONE_META, computeMaxHr, zoneBoundsBpm } from '../../lib/heartRate'
import { targetFromProfile } from '../../lib/calorieTarget'
import { getSettings, saveSettings } from '../../lib/settings'
import { Field } from './fields'

export default function GoalsSection({ zoneAge }: { zoneAge: number }) {
  const initial = getSettings()
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState(String(initial.dailyCalorieTarget))
  const [goal, setGoal] = useState(initial.goal)
  const [targetWeight, setTargetWeight] = useState(initial.targetWeightKg != null ? String(initial.targetWeightKg) : '')
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? '')
  const [calorieMode, setCalorieMode] = useState(initial.calorieMode)
  const [restTimerDefaultSec, setRestTimerDefaultSec] = useState(String(initial.restTimerDefaultSec))
  const [restingHeartRateBpm, setRestingHeartRateBpm] = useState(String(initial.restingHeartRateBpm))
  const [sleepTargetMin, setSleepTargetMin] = useState(String(initial.sleepTargetMin))
  const [savedFlash, setSavedFlash] = useState(false)
  const autoTarget = targetFromProfile({ ...getSettings(), goal })
  const zoneMax = computeMaxHr(zoneAge)
  const zones = zoneBoundsBpm(zoneAge, parseInt(restingHeartRateBpm, 10) || initial.restingHeartRateBpm)
  function submit() {
    saveSettings({
      dailyCalorieTarget: parseInt(dailyCalorieTarget, 10) || initial.dailyCalorieTarget,
      restTimerDefaultSec: parseInt(restTimerDefaultSec, 10) || initial.restTimerDefaultSec,
      restingHeartRateBpm: parseInt(restingHeartRateBpm, 10) || initial.restingHeartRateBpm,
      sleepTargetMin: parseInt(sleepTargetMin, 10) || initial.sleepTargetMin,
      targetWeightKg: parseFloat(targetWeight.replace(',', '.')) > 0 ? parseFloat(targetWeight.replace(',', '.')) : undefined,
      targetDate: targetDate || undefined,
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }
  return (
    <>
      <section className="glass mb-4 space-y-4 rounded-2xl p-4">
        <h2 className="text-sm font-medium text-zinc-400">Objectifs</h2>
        <div>
          <p className="mb-1 text-xs text-zinc-400">Objectif calorique quotidien</p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            {([
              ['auto', 'Calculé'],
              ['manual', 'Manuel'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => {
                  setCalorieMode(mode)
                  saveSettings({ calorieMode: mode })
                }}
                className={`min-h-11 rounded-lg text-sm font-medium ${calorieMode === mode ? 'bg-teal-500 text-white' : 'bg-zinc-900 text-zinc-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {calorieMode === 'auto' ? (
            <div className="rounded-lg bg-zinc-900 p-3">
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                {([
                  ['perte', 'Perdre'],
                  ['maintien', 'Maintenir'],
                  ['prise', 'Prendre'],
                ] as const).map(([g, label]) => (
                  <button
                    key={g}
                    onClick={() => {
                      setGoal(g)
                      saveSettings({ goal: g })
                    }}
                    className={`min-h-11 rounded-lg text-xs font-medium ${goal === g ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-sm font-semibold text-zinc-100">{autoTarget.target} kcal / jour</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Métabolisme de base {autoTarget.bmr} kcal, base {autoTarget.baseline} kcal
                {autoTarget.adjustment !== 0 && ` ${autoTarget.adjustment > 0 ? '+' : '−'} ${Math.abs(autoTarget.adjustment)} selon ton objectif`}. Les
                calories brûlées à l&apos;entraînement s&apos;y ajoutent chaque jour. Le calcul suit ton poids, ta taille et ton âge.
              </p>
            </div>
          ) : (
            <Field label="Cible saisie" value={dailyCalorieTarget} onChange={setDailyCalorieTarget} suffix="kcal" />
          )}
        </div>
        <div>
          <p className="mb-1 text-xs text-zinc-400">Objectif de poids (facultatif)</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Poids cible" value={targetWeight} onChange={setTargetWeight} suffix="kg" />
            <div>
              <label htmlFor="target-date" className="mb-1 block text-xs text-zinc-500">
                Échéance
              </label>
              <input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="min-h-11 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="glass mb-4 space-y-4 rounded-2xl p-4">
        <h2 className="text-sm font-medium text-zinc-400">Entraînement et santé</h2>
        <Field label="Repos par défaut entre séries" value={restTimerDefaultSec} onChange={setRestTimerDefaultSec} suffix="sec" hint="Durée du minuteur qui se lance après chaque série en mode Gym." />
        <Field label="FC de repos (pour le VO2max estimé)" value={restingHeartRateBpm} onChange={setRestingHeartRateBpm} suffix="bpm" hint="Mesure-la au réveil, avant de te lever. Sert aux zones de FC (Karvonen) et au VO2max. Vide = 60 bpm par défaut." />
        <div className="rounded-lg bg-zinc-900 p-3">
          <p className="mb-2 text-xs text-zinc-400">
            Tes zones cardiaques — FC max estimée {zoneMax} bpm (Tanaka), calculées sur ta FC de réserve (Karvonen)
          </p>
          <ul className="space-y-1.5">
            {zones.map((z) => (
              <li key={z.zone} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HR_ZONE_META[z.zone].color }} />
                <span className="flex-1 text-zinc-300">
                  Z{z.zone} · {HR_ZONE_META[z.zone].label}
                </span>
                <span className="font-mono tabular-nums text-zinc-100">
                  {z.minBpm}–{z.maxBpm} bpm
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Field label="Objectif de sommeil" value={sleepTargetMin} onChange={setSleepTargetMin} suffix="min" hint="Ta durée de sommeil visée (480 min = 8 h). Compare la nuit réelle à cet objectif dans la Récup et le score de forme." />
        <button
          onClick={submit}
          className="w-full rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-950 active:bg-zinc-300"
        >
          {savedFlash ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </section>
    </>
  )
}
