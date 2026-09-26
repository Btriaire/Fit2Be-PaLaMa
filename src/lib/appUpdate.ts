// Pont entre le service worker (main.tsx) et l'interface : la nouvelle version
// n'est appliquée que sur demande, pour ne jamais recharger l'app en pleine
// séance ou en plein minuteur.
type Listener = () => void

let needRefresh = false
let apply: (() => void) | null = null
const listeners = new Set<Listener>()

export function setApplyUpdate(fn: () => void) {
  apply = fn
}

export function notifyNeedRefresh() {
  needRefresh = true
  listeners.forEach((l) => l())
}

export function subscribeUpdate(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function getNeedRefresh() {
  return needRefresh
}

export function applyUpdate() {
  apply?.()
}
