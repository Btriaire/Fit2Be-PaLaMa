import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Default injectRegister:'auto' (disabled in vite.config.ts) only fires a
// bare register() with no update logic, so a deployed fix could sit
// invisible behind the old cached bundle indefinitely. This checks for a
// new version immediately, applies it (skipWaiting) without asking, and
// re-checks whenever the app comes back to the foreground — the moment
// that happens after a deploy, the reload carries the new build.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
  },
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateSW()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
