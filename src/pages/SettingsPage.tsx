import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Upload, RefreshCw, Sparkles, User, Camera } from 'lucide-react'
import { getSettings, saveSettings, type Sex } from '../lib/settings'
import { getDb } from '../lib/db'
import { importNutriTrackerActivityHistory } from '../lib/nutriTrackerImport'
import { consolidateData, totalDuplicates, type ConsolidationResult } from '../lib/dataConsolidation'
import { compressImageToDataUrl } from '../lib/image'

export default function SettingsPage() {
  const navigate = useNavigate()
  const initial = getSettings()
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [heightCm, setHeightCm] = useState(String(initial.heightCm))
  const [ageYears, setAgeYears] = useState(String(initial.ageYears))
  const [sex, setSex] = useState<Sex>(initial.sex)
  const [bodyWeightKg, setBodyWeightKg] = useState(initial.bodyWeightKg)
  const [profileSavedFlash, setProfileSavedFlash] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState(initial.profilePhotoDataUrl)
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState(String(initial.dailyCalorieTarget))
  const [restTimerDefaultSec, setRestTimerDefaultSec] = useState(String(initial.restTimerDefaultSec))
  const [restingHeartRateBpm, setRestingHeartRateBpm] = useState(String(initial.restingHeartRateBpm))
  const [sleepTargetMin, setSleepTargetMin] = useState(String(initial.sleepTargetMin))
  const [savedFlash, setSavedFlash] = useState(false)
  const [importFlash, setImportFlash] = useState<string | null>(null)
  const [ntImporting, setNtImporting] = useState(false)
  const [ntImportFlash, setNtImportFlash] = useState<string | null>(null)
  const [dupScanning, setDupScanning] = useState(false)
  const [dupScan, setDupScan] = useState<ConsolidationResult | null>(null)
  const [dupApplying, setDupApplying] = useState(false)
  const [dupFlash, setDupFlash] = useState<string | null>(null)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await compressImageToDataUrl(file)
      setProfilePhoto(dataUrl)
      saveSettings({ profilePhotoDataUrl: dataUrl })
    } catch {
      // photo optionnelle — un échec de lecture/compression ne doit rien casser
    }
  }

  function submitProfile() {
    const saved = saveSettings({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      heightCm: parseFloat(heightCm) || initial.heightCm,
      ageYears: parseInt(ageYears, 10) || initial.ageYears,
      sex,
    })
    setBodyWeightKg(saved.bodyWeightKg)
    setProfileSavedFlash(true)
    setTimeout(() => setProfileSavedFlash(false), 1500)
  }

  async function importFromNutriTracker() {
    setNtImporting(true)
    setNtImportFlash(null)
    try {
      const count = await importNutriTrackerActivityHistory(30, getSettings())
      setNtImportFlash(count > 0 ? `${count} activité(s) importée(s)` : 'Rien de nouveau à importer')
    } catch {
      setNtImportFlash('Échec — vérifie ta connexion et réessaie')
    } finally {
      setNtImporting(false)
      setTimeout(() => setNtImportFlash(null), 4000)
    }
  }

  async function scanDuplicates() {
    setDupScanning(true)
    setDupFlash(null)
    const result = await consolidateData(false)
    setDupScan(result)
    setDupScanning(false)
  }

  async function applyDuplicates() {
    setDupApplying(true)
    const result = await consolidateData(true)
    setDupFlash(
      totalDuplicates(result) > 0
        ? `${totalDuplicates(result)} doublon(s) supprimé(s)`
        : 'Rien à supprimer',
    )
    setDupScan(null)
    setDupApplying(false)
    setTimeout(() => setDupFlash(null), 4000)
  }

  function submit() {
    saveSettings({
      dailyCalorieTarget: parseInt(dailyCalorieTarget, 10) || initial.dailyCalorieTarget,
      restTimerDefaultSec: parseInt(restTimerDefaultSec, 10) || initial.restTimerDefaultSec,
      restingHeartRateBpm: parseInt(restingHeartRateBpm, 10) || initial.restingHeartRateBpm,
      sleepTargetMin: parseInt(sleepTargetMin, 10) || initial.sleepTargetMin,
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

      <section className="glass mb-4 space-y-3 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Profil</h2>
        <div className="flex justify-center">
          <label className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-full bg-zinc-900 text-zinc-600">
            {profilePhoto ? (
              <img src={profilePhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <User size={28} />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/50 py-1">
              <Camera size={12} className="text-white" />
            </span>
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhoto} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Prénom" value={firstName} onChange={setFirstName} onBlur={submitProfile} />
          <TextField label="Nom" value={lastName} onChange={setLastName} onBlur={submitProfile} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Taille" value={heightCm} onChange={setHeightCm} suffix="cm" onBlur={submitProfile} />
          <Field label="Âge" value={ageYears} onChange={setAgeYears} suffix="ans" onBlur={submitProfile} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Sexe</label>
          <div className="flex gap-1.5">
            {(['homme', 'femme'] as Sex[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSex(s)
                  saveSettings({ sex: s })
                }}
                className={`flex-1 rounded-lg py-2.5 text-xs font-medium capitalize ${
                  sex === s ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Poids</span>
            <span className="text-sm font-semibold">{bodyWeightKg} kg</span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-600">Mis à jour automatiquement par NutriTracker (pesées synchronisées)</p>
        </div>
        {profileSavedFlash && <p className="text-center text-xs text-teal-400">Profil enregistré ✓</p>}
      </section>

      <section className="glass mb-4 space-y-4 rounded-2xl p-4">
        <Field label="Objectif calorique quotidien" value={dailyCalorieTarget} onChange={setDailyCalorieTarget} suffix="kcal" />
        <Field label="Repos par défaut entre séries" value={restTimerDefaultSec} onChange={setRestTimerDefaultSec} suffix="sec" />
        <Field label="FC de repos (pour le VO2max estimé)" value={restingHeartRateBpm} onChange={setRestingHeartRateBpm} suffix="bpm" />
        <Field label="Objectif de sommeil" value={sleepTargetMin} onChange={setSleepTargetMin} suffix="min" />
        <button
          onClick={submit}
          className="w-full rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-950 active:bg-zinc-300"
        >
          {savedFlash ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </section>

      <section className="glass mb-4 space-y-2 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-medium text-zinc-400">NutriTracker Palama</h2>
        <button
          onClick={importFromNutriTracker}
          disabled={ntImporting}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-3 text-sm font-medium active:bg-zinc-800 disabled:opacity-60"
        >
          <RefreshCw size={16} className={ntImporting ? 'animate-spin' : ''} />
          {ntImporting ? 'Import en cours…' : "Récupérer l'historique d'activité (30j)"}
        </button>
        {ntImportFlash && <p className="pt-1 text-center text-xs text-zinc-400">{ntImportFlash}</p>}
        <p className="pt-1 text-center text-[11px] text-zinc-600">
          Importe les activités loggées directement dans NutriTracker (hors celles déjà poussées par cette app).
        </p>
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

      <section className="glass mb-4 space-y-2 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Vérifier et consolider</h2>
        <button
          onClick={scanDuplicates}
          disabled={dupScanning}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-3 text-sm font-medium active:bg-zinc-800 disabled:opacity-60"
        >
          <Sparkles size={16} className={dupScanning ? 'animate-pulse' : ''} />
          {dupScanning ? 'Analyse en cours…' : 'Rechercher les doublons'}
        </button>
        <p className="pt-1 text-center text-[11px] text-zinc-600">
          Détecte les séries, activités ou repas identiques logués à la même minute (souvent un double-tap sur "Enregistrer").
        </p>

        {dupScan && (
          <div className="rounded-lg bg-zinc-900 px-3 py-2.5 text-xs text-zinc-300">
            {totalDuplicates(dupScan) === 0 ? (
              <p className="text-center text-zinc-500">Aucun doublon trouvé ✓</p>
            ) : (
              <>
                <ul className="mb-2 space-y-0.5">
                  {dupScan.setsRemoved > 0 && <li>{dupScan.setsRemoved} série(s) de musculation en double</li>}
                  {dupScan.activitiesRemoved > 0 && <li>{dupScan.activitiesRemoved} activité(s) en double</li>}
                  {dupScan.nutritionRemoved > 0 && <li>{dupScan.nutritionRemoved} repas en double</li>}
                  {dupScan.recoveryRemoved > 0 && <li>{dupScan.recoveryRemoved} check-in de récupération en double</li>}
                </ul>
                <button
                  onClick={applyDuplicates}
                  disabled={dupApplying}
                  className="w-full rounded-lg bg-red-500 py-2 text-xs font-semibold text-zinc-950 active:bg-red-400 disabled:opacity-60"
                >
                  {dupApplying ? 'Suppression…' : `Supprimer ${totalDuplicates(dupScan)} doublon(s)`}
                </button>
              </>
            )}
          </div>
        )}
        {dupFlash && <p className="pt-1 text-center text-xs text-teal-400">{dupFlash}</p>}
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  suffix,
  onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix: string
  onBlur?: () => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-zinc-500">{suffix}</span>
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none"
      />
    </div>
  )
}
