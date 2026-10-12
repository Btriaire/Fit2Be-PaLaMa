import { useState } from 'react'
import { User, Camera } from 'lucide-react'
import { getSettings, saveSettings, type Sex } from '../../lib/settings'
import { compressImageToDataUrl } from '../../lib/image'
import { Field, TextField } from './fields'

export default function ProfileSection({ onAgeSaved }: { onAgeSaved?: (age: number) => void }) {
  const initial = getSettings()
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [heightCm, setHeightCm] = useState(String(initial.heightCm))
  const [ageYears, setAgeYears] = useState(String(initial.ageYears))
  const [sex, setSex] = useState<Sex>(initial.sex)
  const [bodyWeightKg, setBodyWeightKg] = useState(initial.bodyWeightKg)
  const [profileSavedFlash, setProfileSavedFlash] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState(initial.profilePhotoDataUrl)

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
    onAgeSaved?.(saved.ageYears)
    setProfileSavedFlash(true)
    setTimeout(() => setProfileSavedFlash(false), 1500)
  }

  return (
    <>
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
    </>
  )
}
