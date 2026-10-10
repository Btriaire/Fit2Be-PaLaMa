import { HR_ZONE_META, computeMaxHr, zoneBoundsBpm } from '../lib/heartRate'
import { targetFromProfile } from '../lib/calorieTarget'
import { todayStr } from '../lib/date'
import SyncStatusLine from '../components/SyncStatusLine'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Upload, RefreshCw, Sparkles, User, Camera } from 'lucide-react'
import { getSettings, saveSettings, type Sex } from '../lib/settings'
import { getDb } from '../lib/db'
import { refreshFitData } from '../lib/fitSync'
import { consolidateData, totalDuplicates, type ConsolidationResult } from '../lib/dataConsolidation'
import { compressImageToDataUrl } from '../lib/image'
import { getTodayGoogleFit } from '../lib/googleFit'
import { playMotivation, type MotivationVoiceId } from '../lib/motivationVoice'

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
  const [goal, setGoal] = useState(initial.goal)
  const [targetWeight, setTargetWeight] = useState(initial.targetWeightKg != null ? String(initial.targetWeightKg) : '')
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? '')
  const [calorieMode, setCalorieMode] = useState(initial.calorieMode)
  const [restTimerDefaultSec, setRestTimerDefaultSec] = useState(String(initial.restTimerDefaultSec))
  const [restingHeartRateBpm, setRestingHeartRateBpm] = useState(String(initial.restingHeartRateBpm))
  const [sleepTargetMin, setSleepTargetMin] = useState(String(initial.sleepTargetMin))
  const [motivationVoice, setMotivationVoice] = useState(initial.motivationVoice)
  const [testingVoice, setTestingVoice] = useState<MotivationVoiceId | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [importFlash, setImportFlash] = useState<string | null>(null)
  const [ntImporting, setNtImporting] = useState(false)
  const [ntImportFlash, setNtImportFlash] = useState<string | null>(null)
  const [dupScanning, setDupScanning] = useState(false)
  const [dupScan, setDupScan] = useState<ConsolidationResult | null>(null)
  const [dupApplying, setDupApplying] = useState(false)
  const [dupFlash, setDupFlash] = useState<string | null>(null)
  const [gfSyncing, setGfSyncing] = useState(false)
  const [gfFlash, setGfFlash] = useState<string | null>(null)
  const autoTarget = targetFromProfile({ ...getSettings(), goal })
  const zoneAge = parseInt(ageYears, 10) || initial.ageYears
  const zoneMax = computeMaxHr(zoneAge)
  const zones = zoneBoundsBpm(zoneAge, parseInt(restingHeartRateBpm, 10) || initial.restingHeartRateBpm)

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

  function selectMotivationVoice(voice: 'off' | 'coach' | 'calme') {
    setMotivationVoice(voice)
    saveSettings({ motivationVoice: voice })
  }

  async function testMotivationVoice(voice: MotivationVoiceId) {
    setTestingVoice(voice)
    await playMotivation(voice, { kind: 'set', exercise: 'Développé couché', weightKg: 80, reps: 8, isPr: true })
    setTestingVoice(null)
  }

  async function importFromNutriTracker() {
    setNtImporting(true)
    setNtImportFlash(null)
    try {
      const r = await refreshFitData(getSettings(), { force: true })
      const parts = [r.imported > 0 ? `${r.imported} activité(s) importée(s)` : 'Rien de nouveau à importer', r.merged > 0 ? `${r.merged} doublon(s) fusionné(s)` : null]
      setNtImportFlash(parts.filter(Boolean).join(' · '))
    } catch {
      setNtImportFlash('Échec — vérifie ta connexion et réessaie')
    } finally {
      setNtImporting(false)
      setTimeout(() => setNtImportFlash(null), 4000)
    }
  }

  async function syncGoogleFitNow() {
    setGfSyncing(true)
    setGfFlash(null)
    try {
      await refreshFitData(getSettings(), { force: true })
      const today = await getTodayGoogleFit()
      setGfFlash(today ? `${today.steps.toLocaleString('fr-FR')} pas aujourd'hui` : 'Rien de disponible pour l\'instant')
    } catch {
      setGfFlash('Échec — vérifie ta connexion et réessaie')
    } finally {
      setGfSyncing(false)
      setTimeout(() => setGfFlash(null), 4000)
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
      targetWeightKg: parseFloat(targetWeight.replace(',', '.')) > 0 ? parseFloat(targetWeight.replace(',', '.')) : undefined,
      targetDate: targetDate || undefined,
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
    a.download = `vibefit-export-${todayStr()}.json`
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

      <section className="glass mb-4 space-y-2 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Voix de motivation</h2>
        <p className="mb-2 text-[11px] text-zinc-600">
          Une phrase générée et dite à voix haute après chaque série (et pendant les séances tapis/vélo de salle) — désactivée par défaut.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'off', label: 'Désactivé' },
              { id: 'coach', label: 'Coach énergique' },
              { id: 'calme', label: 'Motivateur calme' },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => selectMotivationVoice(v.id)}
              className={`rounded-lg px-2 py-2.5 text-center text-xs font-medium ${
                motivationVoice === v.id ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {motivationVoice !== 'off' && (
          <button
            onClick={() => testMotivationVoice(motivationVoice)}
            disabled={testingVoice != null}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 text-xs font-medium active:bg-zinc-800 disabled:opacity-60"
          >
            {testingVoice ? 'Génération…' : 'Tester la voix'}
          </button>
        )}
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
        <button
          onClick={syncGoogleFitNow}
          disabled={gfSyncing}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-3 text-sm font-medium active:bg-zinc-800 disabled:opacity-60"
        >
          <RefreshCw size={16} className={gfSyncing ? 'animate-spin' : ''} />
          {gfSyncing ? 'Synchro en cours…' : 'Synchroniser Google Fit'}
        </button>
        {gfFlash && <p className="pt-1 text-center text-xs text-zinc-400">{gfFlash}</p>}
        <p className="pt-1 text-center text-[11px] text-zinc-600">
          Pas, calories actives et sommeil du jour — mis à jour automatiquement à l'ouverture, ce bouton force une synchro immédiate.
        </p>
      </section>

      <section className="glass mb-4 space-y-2 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Données locales</h2>
        <SyncStatusLine className="pb-1" />
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
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix: string
  onBlur?: () => void
  /** Une phrase sur ce que le réglage change dans l'app (P2). */
  hint?: string
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
      {hint && <p className="mt-1 text-[11px] leading-snug text-zinc-500">{hint}</p>}
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
