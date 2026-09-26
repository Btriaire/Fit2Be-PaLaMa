// État de la sauvegarde vers le VPS : dernière réussite et échecs consécutifs,
// persistés pour survivre à un rechargement.
const KEY = 'fit2be:syncStatus'

export interface SyncStatus {
  lastOkAt: number | null
  consecutiveFails: number
}

type Listener = () => void
const listeners = new Set<Listener>()

function read(): SyncStatus {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as SyncStatus
  } catch {
    // stockage indisponible : on repart d'un état neutre
  }
  return { lastOkAt: null, consecutiveFails: 0 }
}

let current = read()

export function getSyncStatus(): SyncStatus {
  return current
}

export function subscribeSyncStatus(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function recordSyncResult(ok: boolean) {
  const next: SyncStatus = ok
    ? { lastOkAt: Date.now(), consecutiveFails: 0 }
    : { lastOkAt: current.lastOkAt, consecutiveFails: current.consecutiveFails + 1 }
  // Pas de nouvel objet si rien ne change de façon visible (évite des rendus en rafale).
  if (ok && current.consecutiveFails === 0 && current.lastOkAt != null && next.lastOkAt! - current.lastOkAt < 30_000) return
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

/** Vrai quand la sauvegarde a échoué plusieurs fois de suite ou n'a pas réussi depuis > 24 h. */
export function isSyncDegraded(s: SyncStatus, now = Date.now()): boolean {
  return s.consecutiveFails >= 3 || (s.lastOkAt != null && now - s.lastOkAt > 24 * 3600_000 && s.consecutiveFails > 0)
}
