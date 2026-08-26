import { Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import GymHome from './pages/gym/GymHome'
import WorkoutRunner from './pages/gym/WorkoutRunner'
import ActivitiesPage from './pages/activities/ActivitiesPage'
import RecoveryPage from './pages/recovery/RecoveryPage'
import NutritionPage from './pages/nutrition/NutritionPage'

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-md pb-24">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gym" element={<GymHome />} />
          <Route path="/gym/workout/:workoutId" element={<WorkoutRunner />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default App
