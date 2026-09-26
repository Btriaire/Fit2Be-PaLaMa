import { useState, useSyncExternalStore } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { applyUpdate, getNeedRefresh, subscribeUpdate } from '../lib/appUpdate'

/** Bandeau « nouvelle version » : l'utilisateur choisit quand recharger. */
export default function UpdateBanner() {
  const needRefresh = useSyncExternalStore(subscribeUpdate, getNeedRefresh)
  const [dismissed, setDismissed] = useState(false)
  if (!needRefresh || dismissed) return null

  return (
    <div
      role="status"
      className="fixed inset-x-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-teal-400/40 bg-zinc-900/95 py-2.5 pl-4 pr-2 shadow-xl backdrop-blur"
      style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      <RefreshCw size={18} className="shrink-0 text-teal-300" />
      <p className="flex-1 text-sm text-zinc-100">Nouvelle version disponible</p>
      <button onClick={applyUpdate} className="min-h-11 rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white active:scale-95">
        Recharger
      </button>
      <button onClick={() => setDismissed(true)} aria-label="Plus tard" className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400">
        <X size={18} />
      </button>
    </div>
  )
}
