import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Upload } from 'lucide-react'
import { getSettings, saveSettings } from '../lib/settings'
import { getDb } from '../lib/db'

export default function SettingsPage() {
  const navigate = useNavigate()
  const initial = getSettings()
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState(String(initial.dailyCalorieTarget))
  const [restTimerDefaultSec, setRestTimerDefaultSec] = useState(String(initial.restTimerDefaultSec))
  const [savedFlash, setSavedFlash] = useState(false)
  const [importFlash, setImportFlash] = useState<string | null>(null)

  function submit() {
    saveSettings({
      dailyCalorieTarget: parseInt(dailyCalorieTarget, 10) || initial.dailyCalorieTarget,
      restTimerDefaultSec: parseInt(restTimerDefaultSec, 10) || initial.restTimerDefaultSec,
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  async function exportData() {
    const db = await getDb()
    const [workouts, activities, recovery, nutrition] = await Promise.all([
      db.getAll('workouts'),
      db.getAll('activities'),
      db.getAll('recovery'),
      db.getAll('nutrition'),
    ])
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      workouts,
      activities,
      recovery,
      nutrition,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vibefit-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const db = await getDb()
      const tx = db.transaction(['workouts', 'activities', 'recovery', 'nutrition'], 'readwrite')
      for (const w of payload.workouts ?? []) await tx.objectStore('workouts').put(w)
      for (const a of payload.activities ?? []) await tx.objectStore('activities').put(a)
      for (const r of payload.recovery ?? []) await tx.objectStore('recovery').put(r)
      for (const n of payload.nutrition ?? []) await tx.objectStore('nutrition').put(n)
      await tx.done
      if (payload.settings) saveSettings(payload.settings)
      setImportFlash(`Import réussi : ${payload.workouts?.length ?? 0} séances, ${payload.activities?.length ?? 0} activités`)
    } catch {
      setImportFlash('Échec de l\'import — fichier invalide')
    }
    setTimeout(() => setImportFlash(null), 3000)
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">Réglages</h1>
      </header>

      <p className="mb-3 px-1 text-xs text-zinc-500">
        Ton profil démographique (poids, taille, âge, sexe) se règle depuis l'onglet NutriTracker — il sert au calcul
        des calories brûlées.
      </p>

      <section className="glass mb-4 space-y-4 rounded-2xl p-4">
        <Field label="Objectif calorique quotidien" value={dailyCalorieTarget} onChange={setDailyCalorieTarget} suffix="kcal" />
        <Field label="Repos par défaut entre séries" value={restTimerDefaultSec} onChange={setRestTimerDefaultSec} suffix="sec" />
        <button
          onClick={submit}
          className="w-full rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-950 active:bg-zinc-300"
        >
          {savedFlash ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </section>

      <section className="glass mb-4 space-y-2 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Données locales</h2>
        <button
          onClick={exportData}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-3 text-sm font-medium active:bg-zinc-800"
        >
          <Download size={16} /> Exporter en JSON
        </button>
        <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-3 text-sm font-medium active:bg-zinc-800">
          <Upload size={16} /> Importer un JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importData(file)
              e.target.value = ''
            }}
          />
        </label>
        {importFlash && <p className="pt-1 text-center text-xs text-zinc-400">{importFlash}</p>}
        <p className="pt-1 text-center text-xs text-zinc-600">100% local — rien n'est envoyé sur internet.</p>
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-zinc-500">{suffix}</span>
      </div>
    </div>
  )
}
