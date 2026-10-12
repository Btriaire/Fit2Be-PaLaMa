import { useState } from 'react'
import { Download, Upload, Sparkles } from 'lucide-react'
import { getDb } from '../../lib/db'
import { getSettings, saveSettings } from '../../lib/settings'
import { todayStr } from '../../lib/date'
import { consolidateData, totalDuplicates, type ConsolidationResult } from '../../lib/dataConsolidation'
import SyncStatusLine from '../../components/SyncStatusLine'

export default function DataSection() {
  const [importFlash, setImportFlash] = useState<string | null>(null)
  const [dupScanning, setDupScanning] = useState(false)
  const [dupScan, setDupScan] = useState<ConsolidationResult | null>(null)
  const [dupApplying, setDupApplying] = useState(false)
  const [dupFlash, setDupFlash] = useState<string | null>(null)

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
    } catch (error) {
      setImportFlash('Erreur lors de l\'import')
    }
  }

  return (
    <>
      <section className="glass mb-4 space-y-2 rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-medium text-zinc-400">Données locales</h2>
        <SyncStatusLine className="pb-1" />
        <div className="flex gap-2">
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
        </div>
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
    </>
  )
}
