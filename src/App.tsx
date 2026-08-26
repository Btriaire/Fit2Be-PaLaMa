import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import CoverPage from './pages/CoverPage'
import Dashboard from './pages/Dashboard'
import SettingsPage from './pages/SettingsPage'
import GymHome from './pages/gym/GymHome'
import WorkoutRunner from './pages/gym/WorkoutRunner'
import ExerciseHistory from './pages/gym/ExerciseHistory'
import ActivitiesPage from './pages/activities/ActivitiesPage'
import RecoveryPage from './pages/recovery/RecoveryPage'
import NutritionPage from './pages/nutrition/NutritionPage'
import EndurancePage from './pages/endurance/EndurancePage'
import EnduranceHistory from './pages/endurance/EnduranceHistory'
import EnduranceSessionDetail from './pages/endurance/EnduranceSessionDetail'
import StatsPage from './pages/StatsPage'
import ProgressionPage from './pages/ProgressionPage'
import AddPage from './pages/AddPage'

const ENTERED_KEY = 'vibefit_entered'

function App() {
  const [entered, setEntered] = useState(() => localStorage.getItem(ENTERED_KEY) === '1')

  if (!entered) {
    return (
      <CoverPage
        onEnter={() => {
          localStorage.setItem(ENTERED_KEY, '1')
          setEntered(true)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-md pb-24">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gym" element={<GymHome />} />
          <Route path="/gym/workout/:workoutId" element={<WorkoutRunner />} />
          <Route path="/gym/exercise/:exerciseId" element={<ExerciseHistory />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/endurance" element={<EndurancePage />} />
          <Route path="/endurance/session/:sessionId" element={<EnduranceSessionDetail />} />
          <Route path="/endurance/history/:activityType" element={<EnduranceHistory />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/progression" element={<ProgressionPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default App
