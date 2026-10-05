import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { getDb } from './lib/db'
import { restoreFromCloudIfNeeded, pushProfileRecord } from './lib/cloudSync'
import { refreshFitData } from './lib/fitSync'
import { syncLatestWeightFromNutriTracker } from './lib/weight'
import { getSettings, hasStoredSettings } from './lib/settings'
import { effectiveCalorieTarget } from './lib/calorieTarget'
import BottomNav from './components/BottomNav'
import CoverPage from './pages/CoverPage'
import UpdateBanner from './components/UpdateBanner'
import LoginPage from './pages/LoginPage'
import { checkSession, type AuthState } from './lib/auth'
import Dashboard from './pages/Dashboard'
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const GymHome = lazy(() => import('./pages/gym/GymHome'))
const WorkoutRunner = lazy(() => import('./pages/gym/WorkoutRunner'))
const ExerciseHistory = lazy(() => import('./pages/gym/ExerciseHistory'))
const RecoveryPage = lazy(() => import('./pages/recovery/RecoveryPage'))
const NutritionPage = lazy(() => import('./pages/nutrition/NutritionPage'))
const EndurancePage = lazy(() => import('./pages/endurance/EndurancePage'))
const EnduranceHistory = lazy(() => import('./pages/endurance/EnduranceHistory'))
const EnduranceSessionDetail = lazy(() => import('./pages/endurance/EnduranceSessionDetail'))
const ProgressionPage = lazy(() => import('./pages/ProgressionPage'))
const AddPage = lazy(() => import('./pages/AddPage'))
const PhotosPage = lazy(() => import('./pages/PhotosPage'))
const ReferencePage = lazy(() => import('./pages/ReferencePage'))
const TimerPage = lazy(() => import('./pages/TimerPage'))
import OnboardingPage, { ONBOARDED_KEY } from './pages/OnboardingPage'

// Page de garde à chaque lancement (sessionStorage) ; la synchro tourne dès le boot, sans attendre le tap.
function TimerRoute() {
  const navigate = useNavigate()
  return <TimerPage onClose={() => navigate(-1)} />
}

// Activités et Endurance ne font plus qu'une page ("Activité") : les anciens liens y mènent,
// en ouvrant le choix d'activité s'ils demandaient le formulaire.
function ActivitiesRedirect() {
  const state = (useLocation().state ?? {}) as { openForm?: boolean; filterIds?: string[] }
  return <Navigate to="/endurance" replace state={{ openActivity: !!state.openForm, filterIds: state.filterIds }} />
}

const ENTERED_KEY = 'vibefit_entered'

function App() {
  const [auth, setAuth] = useState<AuthState>('checking')
  const [entered, setEntered] = useState(() => sessionStorage.getItem(ENTERED_KEY) === '1')
  // Un profil déjà enregistré (ancien utilisateur) vaut onboarding fait.
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDED_KEY) === '1' || hasStoredSettings())

  // Vérifie la session au lancement et à chaque retour au premier plan.
  useEffect(() => {
    checkSession().then(setAuth)
    function onVisible() {
      if (document.visibilityState === 'visible') checkSession().then(setAuth)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (auth !== 'ok') return
    // Restaure d'abord depuis le VPS (nouvel appareil), puis synchronise la montre :
    // la fusion des doublons doit voir les séances déjà connues.
    getDb()
      .then(restoreFromCloudIfNeeded)
      .finally(() => void refreshFitData(getSettings()).catch(() => {}))
    void syncLatestWeightFromNutriTracker()
    // Pousse le profil (âge, sexe, taille, FC repos) au boot, pas seulement
    // à la sauvegarde des Réglages — sinon un profil jamais retouché depuis
    // cette mise à jour resterait invisible du rapport de progression généré
    // côté serveur (api/progress-report.ts), qui n'a accès qu'à ce qui est
    // synchronisé.
    const s = getSettings()
    // Ne pousse le profil qu'une fois saisi : sinon les valeurs par défaut d'un nouvel appareil écraseraient le vrai profil sur le VPS.
    if (hasStoredSettings()) pushProfileRecord({
      firstName: s.firstName,
      ageYears: s.ageYears,
      sex: s.sex,
      heightCm: s.heightCm,
      bodyWeightKg: s.bodyWeightKg,
      restingHeartRateBpm: s.restingHeartRateBpm,
      dailyCalorieTarget: effectiveCalorieTarget(s).target,
    })
  }, [auth])

  useEffect(() => {
    if (auth !== 'ok') return
    // Reprend l'import dès que l'app revient au premier plan (pas seulement
    // au tout premier chargement) — sinon une marche loggée dans
    // NutriTracker pendant que VibeFit était en arrière-plan n'apparaît
    // qu'au prochain relancement complet. Idem pour le poids : sans ce
    // rafraîchissement global, l'IMC/BMR (calculés depuis settings.bodyWeightKg)
    // restaient figés sur l'ancien poids tant qu'on ne rouvrait pas Diet.
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void refreshFitData(getSettings()).catch(() => {})
        void syncLatestWeightFromNutriTracker()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [auth])

  // Écran de connexion avant tout le reste ; hors ligne ou sans mot de passe côté serveur, on n'est jamais bloqué.
  if (auth === 'checking') return <div className="min-h-screen bg-zinc-950" />
  if (auth === 'login') return <LoginPage onDone={() => setAuth('ok')} />

  if (!entered) {
    return (
      <>
        <CoverPage
          onEnter={() => {
            sessionStorage.setItem(ENTERED_KEY, '1')
            setEntered(true)
          }}
        />
        <UpdateBanner />
      </>
    )
  }

  if (!onboarded) {
    return (
      <>
        <OnboardingPage onDone={() => setOnboarded(true)} />
        <UpdateBanner />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-md pb-24">
        <Suspense fallback={<div className="p-6 text-center text-sm text-zinc-400">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gym" element={<GymHome />} />
          <Route path="/gym/workout/:workoutId" element={<WorkoutRunner />} />
          <Route path="/gym/exercise/:exerciseId" element={<ExerciseHistory />} />
          <Route path="/activities" element={<ActivitiesRedirect />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/endurance" element={<EndurancePage />} />
          <Route path="/endurance/session/:sessionId" element={<EnduranceSessionDetail />} />
          <Route path="/endurance/history/:activityType" element={<EnduranceHistory />} />
          <Route path="/progression" element={<ProgressionPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/photos" element={<PhotosPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/timer" element={<TimerRoute />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        </Suspense>
      </main>
      <BottomNav />
      <UpdateBanner />
    </div>
  )
}

export default App
