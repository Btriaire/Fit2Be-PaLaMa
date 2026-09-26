import { useState } from 'react'
import { ArrowRight, Flame, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import { saveSettings, type Goal, type Sex } from '../lib/settings'
import { targetFromProfile } from '../lib/calorieTarget'
import { logWeight } from '../lib/weight'

const GOALS: { id: Goal; label: string; hint: string; icon: typeof Flame }[] = [
  { id: 'perte', label: 'Perdre du poids', hint: 'Déficit modéré', icon: TrendingDown },
  { id: 'maintien', label: 'Me maintenir', hint: 'Équilibre', icon: Scale },
  { id: 'prise', label: 'Prendre du muscle', hint: 'Léger excédent', icon: TrendingUp },
]

export const ONBOARDED_KEY = 'fit2be:onboarded'

function num(v: string): number {
  return parseFloat(v.replace(',', '.'))
}

/** Profil du premier lancement : les calories, zones de FC et objectifs en dépendent. */
export default function OnboardingPage({ onDone }: { onDone: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [sex, setSex] = useState<Sex>('homme')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [restHr, setRestHr] = useState('')
  const [goal, setGoal] = useState<Goal>('maintien')
  const [touched, setTouched] = useState(false)

  const ageN = num(age)
  const heightN = num(height)
  const weightN = num(weight)
  const restN = restHr.trim() === '' ? 60 : num(restHr)

  const errors = {
    age: !(ageN >= 14 && ageN <= 90) ? 'Entre 14 et 90 ans' : null,
    height: !(heightN >= 130 && heightN <= 220) ? 'Entre 130 et 220 cm' : null,
    weight: !(weightN >= 30 && weightN <= 250) ? 'Entre 30 et 250 kg' : null,
    restHr: !(restN >= 35 && restN <= 100) ? 'Entre 35 et 100 bpm' : null,
  }
  const valid = !errors.age && !errors.height && !errors.weight && !errors.restHr

  const preview = valid
    ? targetFromProfile({
        firstName,
        lastName: '',
        sex,
        ageYears: ageN,
        heightCm: heightN,
        bodyWeightKg: weightN,
        dailyCalorieTarget: 0,
        restTimerDefaultSec: 90,
        restingHeartRateBpm: restN,
        sleepTargetMin: 480,
        motivationVoice: 'off',
        goal,
        calorieMode: 'auto',
      })
    : null

  async function submit() {
    setTouched(true)
    if (!valid || !preview) return
    saveSettings({
      firstName: firstName.trim(),
      sex,
      ageYears: Math.round(ageN),
      heightCm: heightN,
      bodyWeightKg: weightN,
      restingHeartRateBpm: Math.round(restN),
      goal,
      calorieMode: 'auto',
      dailyCalorieTarget: preview.target,
    })
    await logWeight(weightN)
    localStorage.setItem(ONBOARDED_KEY, '1')
    onDone()
  }

  function skip() {
    saveSettings({})
    localStorage.setItem(ONBOARDED_KEY, '1')
    onDone()
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-5 pb-10 pt-[calc(env(safe-area-inset-top)+28px)] text-zinc-100">
      <div className="mx-auto max-w-md">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-orange-300">Bienvenue</p>
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight">Faisons connaissance</h1>
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">
          Ces quelques infos servent à calculer tes calories, tes zones de fréquence cardiaque et tes objectifs. Sans elles, l&apos;app
          utilise des valeurs moyennes (75 kg, 175 cm, 30 ans) qui faussent tout.
        </p>

        <div className="glass mb-4 space-y-4 rounded-2xl p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Prénom (facultatif)</span>
            <input
              id="ob-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="w-full rounded-lg bg-zinc-900 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400/60"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs text-zinc-400">Sexe (pour le métabolisme de base)</span>
            <div className="grid grid-cols-2 gap-2">
              {(['homme', 'femme'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  className={`min-h-11 rounded-lg text-sm font-medium capitalize ${sex === s ? 'bg-teal-500 text-white' : 'bg-zinc-900 text-zinc-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumField id="ob-age" label="Âge" suffix="ans" value={age} onChange={setAge} error={touched ? errors.age : null} />
            <NumField id="ob-height" label="Taille" suffix="cm" value={height} onChange={setHeight} error={touched ? errors.height : null} />
            <NumField id="ob-weight" label="Poids" suffix="kg" value={weight} onChange={setWeight} error={touched ? errors.weight : null} />
          </div>

          <NumField
            id="ob-hr"
            label="FC de repos (facultatif — 60 par défaut)"
            suffix="bpm"
            value={restHr}
            onChange={setRestHr}
            error={touched ? errors.restHr : null}
            hint="Mesure-la au réveil, avant de te lever."
          />
        </div>

        <p className="mb-2 text-xs text-zinc-400">Ton objectif</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {GOALS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setGoal(id)}
              className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center ${
                goal === id ? 'border-orange-400 bg-orange-500/15 text-orange-200' : 'border-zinc-800 bg-zinc-900/60 text-zinc-300'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-semibold leading-tight">{label}</span>
              <span className="text-[10px] text-zinc-400">{hint}</span>
            </button>
          ))}
        </div>

        {preview && (
          <div className="mb-5 rounded-2xl border border-teal-400/30 bg-teal-500/10 p-4 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-teal-200">
              <Flame size={16} /> Objectif calorique estimé : {preview.target} kcal / jour
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Métabolisme de base {preview.bmr} kcal, base {preview.baseline} kcal
              {preview.adjustment !== 0 && ` ${preview.adjustment > 0 ? '+' : '−'} ${Math.abs(preview.adjustment)} selon ton objectif`}. Les calories
              brûlées à l&apos;entraînement s&apos;y ajoutent chaque jour. Modifiable dans Réglages.
            </p>
          </div>
        )}

        <button
          onClick={submit}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 text-base font-semibold text-zinc-950 shadow-lg shadow-orange-500/30 active:scale-[0.98]"
        >
          C&apos;est parti <ArrowRight size={18} />
        </button>
        <button onClick={skip} className="mt-3 min-h-11 w-full text-sm text-zinc-400 underline-offset-2 active:underline">
          Plus tard (valeurs moyennes)
        </button>
      </div>
    </div>
  )
}

function NumField({
  id,
  label,
  suffix,
  value,
  onChange,
  error,
  hint,
}: {
  id: string
  label: string
  suffix: string
  value: string
  onChange: (v: string) => void
  error: string | null
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      <div className={`flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 focus-within:ring-2 focus-within:ring-teal-400/60 ${error ? 'ring-2 ring-orange-500/70' : ''}`}>
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error != null}
          className="min-h-12 w-full min-w-0 bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-zinc-500">{suffix}</span>
      </div>
      {error ? <span className="mt-1 block text-[11px] text-orange-300">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  )
}
