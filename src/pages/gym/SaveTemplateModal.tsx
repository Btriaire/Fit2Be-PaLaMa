import { useState } from 'react'
import { Camera, X } from 'lucide-react'
import { saveCustomTemplate, exercisesFromWorkout, compressImageToDataUrl } from '../../lib/customTemplates'
import type { Workout } from '../../types'

export function SaveTemplateModal({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [name, setName] = useState(workout.name)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setPhotoDataUrl(await compressImageToDataUrl(file))
    } catch {
      // photo optionnelle — un échec de lecture/compression ne doit pas bloquer la sauvegarde
    }
  }

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    await saveCustomTemplate(name.trim(), exercisesFromWorkout(workout), photoDataUrl ?? undefined)
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="mesh-backdrop w-full max-w-md rounded-t-2xl bg-zinc-950 border-t border-zinc-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Enregistrer comme modèle</h2>
          <button onClick={onClose} className="rounded-full p-1 active:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-zinc-900 text-zinc-600">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera size={20} />
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </label>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Nom du modèle</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          {workout.exercises.length} exercice{workout.exercises.length > 1 ? 's' : ''} — réutilisable depuis "Mes modèles" sur l'accueil Gym.
        </p>

        <button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-zinc-950 active:bg-orange-400 disabled:opacity-50"
        >
          {saved ? 'Enregistré ✓' : saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
