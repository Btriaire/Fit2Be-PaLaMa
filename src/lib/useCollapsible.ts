import { useState } from 'react'

const KEY_PREFIX = 'fit2be:collapsible:'

/** Repli/dépli persistant (localStorage) pour les bandeaux à choix multiple
 * (coaching, templates...) — sans ça, rouvrir la page les remet toujours à
 * l'état replié par défaut et oblige à retaper à chaque visite. */
export function useCollapsible(key: string, defaultOpen = false): [boolean, (v: boolean | ((prev: boolean) => boolean)) => void] {
  const [open, setOpenState] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + key)
      return raw != null ? raw === '1' : defaultOpen
    } catch {
      return defaultOpen
    }
  })

  function setOpen(v: boolean | ((prev: boolean) => boolean)) {
    setOpenState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v
      try {
        localStorage.setItem(KEY_PREFIX + key, next ? '1' : '0')
      } catch {
        // stockage indisponible (navigation privée...) — le repli reste fonctionnel, juste pas mémorisé
      }
      return next
    })
  }

  return [open, setOpen]
}
