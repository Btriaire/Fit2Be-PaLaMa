import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Apple, ChevronLeft, ChevronRight, Flame, Footprints, Mic, Plus, Scale, Square, Trash2, User, X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getDb, newId } from '../../lib/db'
import { getSettings } from '../../lib/settings'
import { isSameDay, formatTime, formatDate, formatFullDate, todayStr, addDays } from '../../lib/date'
import { getAllWorkouts, estimateWorkoutCalories } from '../../lib/workouts'
import { getWeightLogs, logWeight, deleteWeightLog, adoptWeightFromSync } from '../../lib/weight'
import { pushFoodToNutriTracker, pullLatestWeightFromNutriTracker, pullNutritionFromNutriTracker, type RemoteNutritionTotals } from '../../lib/nutriTrackerSync'
import { getGoogleFitForDate } from '../../lib/googleFit'
import { computeCaloriesFromSteps } from '../../lib/met'
import ActivityHero from '../../components/ActivityHero'
import type { ActivityLog, GoogleFitDay, NutritionEntry, WeightLog, Workout } from '../../types'

export default function NutritionPage() {
  const [entries, setEntries] = useState<NutritionEntry[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [formOpen, setFormOpen] = useState(false)
  const [settings, setSettings] = useState(getSettings())
  const [remoteNutrition, setRemoteNutrition] = useState<RemoteNutritionTotals | null>(null)
  const [googleFitDay, setGoogleFitDay] = useState<GoogleFitDay | null>(null)

  async function refresh() {
    const db = await getDb()
    const all = await db.getAllFromIndex('nutrition', 'byLoggedAt')
    setEntries(all.reverse())
    setActivities(await db.getAll('activities'))
    setWorkouts(await getAllWorkouts())
    setWeightLogs(await getWeightLogs())
    setSettings(getSettings())

    const pulled = await pullLatestWeightFromNutriTracker()
    if (pulled.weightKg && pulled.date) {
      const adopted = await adoptWeightFromSync(pulled.weightKg, pulled.date)
      if (adopted) {
        setWeightLogs(await getWeightLogs())
        setSettings(getSettings())
      }
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    pullNutritionFromNutriTracker(selectedDate).then(setRemoteNutrition)
    getGoogleFitForDate(selectedDate).then(setGoogleFitDay)
  }, [selectedDate])

  const dayEntries = useMemo(() => entries.filter((e) => isSameDay(e.loggedAt, selectedDate)), [entries, selectedDate])
  // On ajoute ce qui a été loggé directement dans NutriTracker (le serveur
  // exclut déjà ce que cette app y a elle-même poussé, donc pas de double compte).
  const consumed = dayEntries.reduce((s, e) => s + e.calories, 0) + (remoteNutrition?.calories ?? 0)
  const protein = dayEntries.reduce((s, e) => s + (e.proteinG ?? 0), 0) + (remoteNutrition?.proteinG ?? 0)
  const carbs = dayEntries.reduce((s, e) => s + (e.carbsG ?? 0), 0) + (remoteNutrition?.carbsG ?? 0)
  const fat = dayEntries.reduce((s, e) => s + (e.fatG ?? 0), 0) + (remoteNutrition?.fatG ?? 0)
  const sugar = dayEntries.reduce((s, e) => s + (e.sugarG ?? 0), 0) + (remoteNutrition?.sugarG ?? 0)

  const gymCalories = useMemo(
    () =>
      workouts
        .filter((w) => w.finishedAt && isSameDay(w.startedAt, selectedDate))
        .reduce((s, w) => s + estimateWorkoutCalories(w, settings), 0),
    [workouts, settings, selectedDate],
  )
  const activityCalories = useMemo(
    () => activities.filter((a) => isSameDay(a.loggedAt, selectedDate)).reduce((s, a) => s + a.caloriesBurned, 0),
    [activities, selectedDate],
  )
  // NEAT : activité "non sportive" du jour (pas comptés), distincte des
  // séances de sport déjà comptées via gymCalories/activityCalories.
  const stepsCalories = googleFitDay ? computeCaloriesFromSteps(googleFitDay.steps, settings) : 0
  const totalBurned = gymCalories + activityCalories + stepsCalories
  const adjustedTarget = settings.dailyCalorieTarget + totalBurned
  const remaining = adjustedTarget - consumed
  const pct = Math.min(100, Math.round((consumed / adjustedTarget) * 100))

  async function addEntry(entry: Omit<NutritionEntry, 'id' | 'loggedAt'>) {
    const db = await getDb()
    const loggedAt = selectedDate === todayStr() ? Date.now() : new Date(`${selectedDate}T12:00:00`).getTime()
    const e: NutritionEntry = { ...entry, id: newId(), loggedAt }
    await db.put('nutrition', e)
    setFormOpen(false)
    refresh()
    void pushFoodToNutriTracker({
      name: entry.label,
      calories: entry.calories,
      proteinG: entry.proteinG,
      carbsG: entry.carbsG,
      fatG: entry.fatG,
      sugarG: entry.sugarG,
    })
  }

  async function removeEntry(id: string) {
    if (!confirm('Supprimer ce repas ?')) return
    const db = await getDb()
    await db.delete('nutrition', id)
    refresh()
  }

  async function addWeight(weightKg: number) {
    await logWeight(weightKg)
    refresh()
  }

  async function removeWeight(id: string) {
    if (!confirm('Supprimer cette pesée ?')) return
    await deleteWeightLog(id)
    refresh()
  }

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="food" className="h-40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <Apple className="text-teal-400" size={24} />
          <h1 className="text-xl font-semibold tracking-tight text-white drop-shadow">Diet Deficit</h1>
        </div>
      </div>

      <div className="px-4 pt-4">

      <div className="glass mb-4 flex items-center justify-between rounded-2xl p-2">
        <button
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          className="rounded-full p-2 text-zinc-400 active:bg-zinc-900"
          aria-label="Jour précédent"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setSelectedDate(todayStr())}
          className="flex-1 text-center text-sm font-medium capitalize"
        >
          {formatFullDate(selectedDate)}
        </button>
        <button
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          disabled={selectedDate >= todayStr()}
          className="rounded-full p-2 text-zinc-400 active:bg-zinc-900 disabled:opacity-30"
          aria-label="Jour suivant"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <Link to="/settings" className="glass mb-4 flex w-full items-center justify-between rounded-2xl p-4 active:bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <User size={16} className="text-teal-400" />
          <span className="text-sm font-medium">
            {settings.firstName || 'Profil'} — {settings.bodyWeightKg}kg · {settings.heightCm}cm · {settings.ageYears} ans
          </span>
        </div>
        <ChevronRight size={16} className="text-zinc-500" />
      </Link>

      <WeightTracker logs={weightLogs} currentWeight={settings.bodyWeightKg} onLog={addWeight} onDelete={removeWeight} />

      <div className="glass mb-4 rounded-2xl p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm text-zinc-400">Consommées</p>
          <p className="text-sm text-zinc-400">Objectif {settings.dailyCalorieTarget} kcal</p>
        </div>
        <p className="mb-2 text-3xl font-bold text-teal-400">{consumed} kcal</p>
        <div className="mb-1 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-zinc-500">
          {remaining >= 0 ? `${remaining} kcal restantes` : `${-remaining} kcal au-dessus de l'objectif`}
          {totalBurned > 0 && <span className="text-zinc-600"> · objectif ajusté avec {totalBurned} kcal brûlées</span>}
        </p>
        {!!remoteNutrition?.calories && (
          <p className="mt-1 text-[11px] text-zinc-600">
            dont {remoteNutrition.calories} kcal loggées directement dans NutriTracker
          </p>
        )}
      </div>

      {totalBurned > 0 && (
        <div className="glass mb-4 rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Flame size={14} className="text-orange-400" />
            <p className="text-sm font-medium text-zinc-300">Calories brûlées ce jour-là</p>
          </div>
          <p className="mb-2 text-2xl font-bold text-orange-400">{totalBurned} kcal</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>🏋️‍♂️ Gym : {gymCalories} kcal</span>
            <span>🏃 Activités : {activityCalories} kcal</span>
            {stepsCalories > 0 && (
              <span className="flex items-center gap-1">
                <Footprints size={12} /> {googleFitDay?.steps.toLocaleString('fr-FR')} pas : {stepsCalories} kcal
              </span>
            )}
          </div>
        </div>
      )}

      {(protein > 0 || carbs > 0 || fat > 0) && (
        <div className="mb-6 grid grid-cols-2 gap-2">
          <MacroTile label="Protéines" value={protein} color="bg-rose-500" />
          <MacroTile label="Glucides" value={carbs} color="bg-amber-500" />
          <MacroTile label="dont Sucres" value={sugar} color="bg-orange-400" />
          <MacroTile label="Lipides" value={fat} color="bg-teal-500" />
        </div>
      )}
      {!(protein > 0 || carbs > 0 || fat > 0) && <div className="mb-6" />}

      <button
        onClick={() => setFormOpen(true)}
        className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
      >
        <Plus size={16} /> Ajouter un repas
      </button>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-400">Journal</h2>
          <p className="text-xs text-zinc-600">
            {dayEntries.length} repas · {consumed} kcal
          </p>
        </div>
        {dayEntries.length === 0 && <p className="text-sm text-zinc-500">Rien enregistré ce jour-là.</p>}
        <ul className="space-y-2">
          {dayEntries.map((e) => (
            <li key={e.id} className="glass flex items-center justify-between rounded-xl p-3">
              <div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-xs text-zinc-500">
                  {formatTime(e.loggedAt)}
                  {(e.carbsG || e.sugarG) && (
                    <span className="ml-1.5 text-zinc-600">
                      · Glucides {e.carbsG ?? 0}g · Sucres {e.sugarG ?? 0}g
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-teal-400">{e.calories} kcal</p>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="shrink-0 rounded-full p-1 text-zinc-600 active:bg-red-500/10 active:text-red-400"
                  aria-label="Supprimer le repas"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {formOpen && <NutritionForm onSubmit={addEntry} onClose={() => setFormOpen(false)} />}
      </div>
    </div>
  )
}

function WeightTracker({
  logs,
  currentWeight,
  onLog,
  onDelete,
}: {
  logs: WeightLog[]
  currentWeight: number
  onLog: (weightKg: number) => void
  onDelete: (id: string) => void
}) {
  const [value, setValue] = useState(String(currentWeight))
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    setValue(String(currentWeight))
  }, [currentWeight])

  function submit() {
    const w = parseFloat(value)
    if (!w || w <= 0) return
    onLog(w)
  }

  const chartData = [...logs].reverse().map((l) => ({ ...l, label: formatDate(l.loggedAt) }))
  const trend = logs.length >= 2 ? logs[0].weightKg - logs[1].weightKg : 0

  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scale size={16} className="text-teal-400" />
          <p className="text-sm font-medium text-zinc-300">Suivi du poids</p>
        </div>
        {logs.length > 0 && (
          <p className="text-xs text-zinc-500">
            {logs[0].weightKg}kg
            {trend !== 0 && (
              <span className={trend > 0 ? 'text-orange-400' : 'text-teal-400'}>
                {' '}
                ({trend > 0 ? '+' : ''}
                {trend.toFixed(1)}kg)
              </span>
            )}
          </p>
        )}
      </div>

      {chartData.length >= 2 && (
        <div className="mb-3 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Line type="monotone" dataKey="weightKg" name="Poids (kg)" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3, fill: '#38bdf8' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-lg bg-zinc-900 px-3 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-teal-500"
        />
        <button
          onClick={submit}
          className="shrink-0 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 active:bg-teal-400"
        >
          Peser
        </button>
      </div>
      {logs.length === 0 && <p className="mt-2 text-xs text-zinc-600">Aucune pesée enregistrée pour l'instant.</p>}

      {logs.length > 0 && (
        <>
          <button onClick={() => setHistoryOpen((v) => !v)} className="mt-3 w-full text-center text-xs text-zinc-500 active:text-zinc-300">
            {historyOpen ? 'Masquer' : 'Voir'} l'historique des pesées ({logs.length})
          </button>
          {historyOpen && (
            <ul className="mt-2 space-y-1">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-xs">
                  <span className="text-zinc-400">{formatDate(l.loggedAt)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-zinc-200">{l.weightKg}kg</span>
                    <button
                      onClick={() => onDelete(l.id)}
                      className="rounded-full p-1 text-zinc-600 active:bg-red-500/10 active:text-red-400"
                      aria-label="Supprimer cette pesée"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
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
  const [sugarG, setSugarG] = useState('')
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
      sugarG: sugarG ? parseFloat(sugarG) : undefined,
      rawInput: label,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop w-full max-w-md rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
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
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2.5 outline-none focus:ring-1 focus:ring-teal-500"
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
          className="mb-3 w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-center outline-none focus:ring-1 focus:ring-teal-500"
        />

        <label className="mb-1 block text-xs text-zinc-500">Macros (optionnel, en grammes)</label>
        <div className="mb-4 grid grid-cols-2 gap-1.5">
          <input
            inputMode="decimal"
            placeholder="Protéines"
            value={proteinG}
            onChange={(e) => setProteinG(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />
          <input
            inputMode="decimal"
            placeholder="Lipides"
            value={fatG}
            onChange={(e) => setFatG(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />
          <input
            inputMode="decimal"
            placeholder="Glucides"
            value={carbsG}
            onChange={(e) => setCarbsG(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />
          <input
            inputMode="decimal"
            placeholder="Sucres"
            value={sugarG}
            onChange={(e) => setSugarG(e.target.value)}
            className="rounded-lg bg-zinc-900 px-2 py-2.5 text-center text-sm outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <button
          onClick={submit}
          className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 active:bg-teal-400"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
