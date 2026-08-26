import { useEffect, useMemo, useState } from 'react'
import { Apple, Mic, Plus, Square, X } from 'lucide-react'
import { getDb, newId } from '../../lib/db'
import { getSettings } from '../../lib/settings'
import { isToday, formatTime } from '../../lib/date'
import type { NutritionEntry } from '../../types'

export default function NutritionPage() {
  const [entries, setEntries] = useState<NutritionEntry[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const settings = getSettings()

  async function refresh() {
    const db = await getDb()
    const all = await db.getAllFromIndex('nutrition', 'byLoggedAt')
    setEntries(all.reverse())
  }

  useEffect(() => {
    refresh()
  }, [])

  const todayEntries = useMemo(() => entries.filter((e) => isToday(e.loggedAt)), [entries])
  const consumed = todayEntries.reduce((s, e) => s + e.calories, 0)
  const protein = todayEntries.reduce((s, e) => s + (e.proteinG ?? 0), 0)
  const carbs = todayEntries.reduce((s, e) => s + (e.carbsG ?? 0), 0)
  const fat = todayEntries.reduce((s, e) => s + (e.fatG ?? 0), 0)
  const remaining = settings.dailyCalorieTarget - consumed
  const pct = Math.min(100, Math.round((consumed / settings.dailyCalorieTarget) * 100))

  async function addEntry(entry: Omit<NutritionEntry, 'id' | 'loggedAt'>) {
    const db = await getDb()
    const e: NutritionEntry = { ...entry, id: newId(), loggedAt: Date.now() }
    await db.put('nutrition', e)
    setFormOpen(false)
    refresh()
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <Apple className="text-sky-400" size={26} />
        <h1 className="text-xl font-semibold tracking-tight">NutriTracker</h1>
      </header>

      <div className="glass mb-4 rounded-2xl p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm text-zinc-400">Consommées</p>
          <p className="text-sm text-zinc-400">Objectif {settings.dailyCalorieTarget} kcal</p>
        </div>
        <p className="mb-2 text-3xl font-bold text-sky-400">{consumed} kcal</p>
        <div className="mb-1 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-zinc-500">{remaining >= 0 ? `${remaining} kcal restantes` : `${-remaining} kcal au-dessus de l'objectif`}</p>
      </div>

      {(protein > 0 || carbs > 0 || fat > 0) && (
        <div className="mb-6 grid grid-cols-3 gap-2">
          <MacroTile label="Protéines" value={protein} color="bg-rose-500" />
          <MacroTile label="Glucides" value={carbs} color="bg-amber-500" />
          <MacroTile label="Lipides" value={fat} color="bg-emerald-500" />
        </div>
      )}
      {!(protein > 0 || carbs > 0 || fat > 0) && <div className="mb-6" />}

      <button
        onClick={() => setFormOpen(true)}
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-500 py-3 text-sm font-semibold text-zinc-950 active:bg-sky-400"
      >
        <Plus size={16} /> Ajouter un repas
      </button>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Journal</h2>
        {entries.length === 0 && <p className="text-sm text-zinc-500">Rien pour l'instant.</p>}
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="glass flex items-center justify-between rounded-xl p-3">
              <div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-xs text-zinc-500">
                  {formatTime(e.loggedAt)}
                  {(e.proteinG || e.carbsG || e.fatG) && (
                    <span className="ml-1.5 text-zinc-600">
                      · P{e.proteinG ?? 0}g G{e.carbsG ?? 0}g L{e.fatG ?? 0}g
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm font-semibold text-sky-400">{e.calories} kcal</p>
            </li>
          ))}
        </ul>
      </section>

      {formOpen && <NutritionForm onSubmit={addEntry} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function MacroTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <span className={`mx-auto mb-1.5 block h-1.5 w-6 rounded-full ${color}`} />
      <p className="text-base font-bold">{Math.round(value)}g</p>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  )
}

type SpeechRecognitionCtor = new () => SpeechRecognition

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function NutritionForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (entry: Omit<NutritionEntry, 'id' | 'loggedAt'>) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState('')
  const [calories, setCalories] = useState('')
  const [proteinG, setProteinG] = useState('')
  const [carbsG, setCarbsG] = useState('')
  const [fatG, setFatG] = useState('')
  const [listening, setListening] = useState(false)
  const speechSupported = getSpeechRecognitionCtor() !== null

  function toggleVoice() {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    if (listening) {
      setListening(false)
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) setLabel((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.start()
    setListening(true)
  }

  function submit() {
    const kcal = parseInt(calories, 10)
    if (!label.trim() || !kcal) return
    onSubmit({
      label: label.trim(),
      calories: kcal,
      proteinG: proteinG ? parseFloat(proteinG) : undefined,
      carbsG: carbsG ? parseFloat(carbsG) : undefined,
      fatG: fatG ? parseFloat(fatG) : undefined,
      rawInput: label,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Nouveau repas</h2>
          <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <label className="mb-1 block text-xs text-zinc-500">Description (Quick-Log)</label>
        <div className="mb-3 flex items-center gap-1.5">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex: 200g de poulet + riz"
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2.5 outline-none focus:ring-1 focus:ring-sky-500"
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              className={`shrink-0 rounded-lg p-2.5 ${listening ? 'bg-red-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}
              aria-label="Dictée vocale"
            >
              {listening ? <Square size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>

        <label className="mb-1 block text-xs text-zinc-500">Calories (kcal)</label>
        <input
          inputMode="numeric"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-sky-500"
        />

        <label className="mb-1 block text-xs text-zinc-500">Macros (optionnel, en grammes)</label>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          <input
            inputMode="decimal"
            placeholder="Protéines"
            value={proteinG}
            onChange={(e) => setProteinG(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-sky-500"
          />
          <input
            inputMode="decimal"
            placeholder="Glucides"
            value={carbsG}
            onChange={(e) => setCarbsG(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-sky-500"
          />
          <input
            inputMode="decimal"
            placeholder="Lipides"
            value={fatG}
            onChange={(e) => setFatG(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <button
          onClick={submit}
          className="w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-zinc-950 active:bg-sky-400"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
