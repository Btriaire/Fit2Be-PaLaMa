import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { notifyNeedRefresh, setApplyUpdate } from './lib/appUpdate'

// Le service worker vérifie les mises à jour dès le lancement et à chaque retour
// au premier plan. Une nouvelle version n'est appliquée qu'à la demande de
// l'utilisateur (bandeau « Nouvelle version disponible ») : jamais de rechargement
// surprise pendant une séance ou un minuteur.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    notifyNeedRefresh()
  },
})
setApplyUpdate(() => updateSW(true))

// Vérification explicite d'une nouvelle version au lancement et au retour au
// premier plan (elle ne l'applique pas : c'est le bandeau qui le fait), puis
// rechargement dès que le nouveau service worker prend le contrôle.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => reg?.update())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((reg) => reg?.update())
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
