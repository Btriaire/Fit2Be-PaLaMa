import { useSyncExternalStore } from 'react'
import { CloudCheck, CloudOff } from 'lucide-react'
import { getSyncStatus, isSyncDegraded, subscribeSyncStatus } from '../lib/syncStatus'

function ago(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}

/** Ligne discrète : dernière sauvegarde réussie, ou alerte si elle échoue de façon répétée. */
export default function SyncStatusLine({ className = '' }: { className?: string }) {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
  const degraded = isSyncDegraded(status)

  if (degraded) {
    return (
      <p className={`flex items-center justify-center gap-1.5 text-xs text-orange-300 ${className}`}>
        <CloudOff size={14} />
        Sauvegarde impossible pour l&apos;instant — tes données restent sur cet appareil.
      </p>
    )
  }
  if (status.lastOkAt == null) return null
  return (
    <p className={`flex items-center justify-center gap-1.5 text-xs text-zinc-400 ${className}`}>
      <CloudCheck size={14} />
      Sauvegardé {ago(status.lastOkAt)}
    </p>
  )
}
