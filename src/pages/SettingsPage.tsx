import DataSection from './settings/DataSection'
import IntegrationsSection from './settings/IntegrationsSection'
import ProfileSection from './settings/ProfileSection'
import GoalsSection from './settings/GoalsSection'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { getSettings } from '../lib/settings'

export default function SettingsPage() {
  const navigate = useNavigate()
  const initial = getSettings()
  const [zoneAge, setZoneAge] = useState(initial.ageYears)
  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">Réglages</h1>
      </header>

      <ProfileSection onAgeSaved={setZoneAge} />

      <GoalsSection zoneAge={zoneAge} />

      <IntegrationsSection />

      <DataSection />
    </div>
  )
}
