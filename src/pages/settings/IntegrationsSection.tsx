import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getSettings, saveSettings } from '../../lib/settings'
import { playMotivation, type MotivationVoiceId } from '../../lib/motivationVoice'
import { refreshFitData } from '../../lib/fitSync'
import { getTodayGoogleFit } from '../../lib/googleFit'

export default function IntegrationsSection() {
  const [motivationVoice, setMotivationVoice] = useState<'off' | 'coach' | 'calme'>(getSettings().motivationVoice)
  const [testingVoice, setTestingVoice] = useState<MotivationVoiceId | null>(null)
  const [ntImporting, setNtImporting] = useState(false)
  const [ntImportFlash, setNtImportFlash] = useState<string | null>(null)
  const [gfSyncing, setGfSyncing] = useState(false)
  const [gfFlash, setGfFlash] = useState<string | null>(null)

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

  return (
    <>
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
    </>
  )
}
