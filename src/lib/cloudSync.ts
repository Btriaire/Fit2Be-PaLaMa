// Durable-storage sync to the small self-hosted server on the VPS — the
// point is to survive a PWA reinstall wiping local IndexedDB (which
// happened), not to be a real-time multi-device sync. Best-effort only:
// every call swallows its own errors so a sync hiccup (offline, VPS
// restart) never blocks the local save that already succeeded.

export const SYNCABLE_STORES = ['workouts', 'activities', 'recovery', 'nutrition', 'weightLogs', 'endurance', 'customTemplates', 'dailyPhotos', 'customEndurancePrograms'] as const
export type SyncableStore = (typeof SYNCABLE_STORES)[number]

export function pushRecord(store: SyncableStore, id: string, data: unknown): void {
  fetch('/api/cloudsync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ store, id, data }),
  }).catch(() => {
    // offline or endpoint unavailable — local save already succeeded, ignore
  })
}

export function deleteRecord(store: SyncableStore, id: string): void {
  fetch('/api/cloudsync', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ store, id }),
  }).catch(() => {
    // same — best effort
  })
}

interface CloudRecord {
  id: string
  data: unknown
  updatedAt: number
}

async function pullAll(): Promise<Partial<Record<SyncableStore, CloudRecord[]>>> {
  try {
    const r = await fetch('/api/cloudsync')
    if (!r.ok) return {}
    return await r.json()
  } catch {
    return {}
  }
}

const RESTORE_FLAG_KEY = 'fit2be:cloudRestoreDone'

/** Repeuple IndexedDB depuis le VPS — utile après une réinstallation de la
 * PWA (le service worker/l'écran d'accueil sont refaits à neuf mais
 * IndexedDB aurait dû survivre ; ceci est le filet de sécurité si jamais ce
 * n'est pas le cas). Ne réécrit jamais par-dessus une entrée locale plus
 * récente — fusionne, ne remplace pas aveuglément. Ne tourne qu'une fois par
 * navigateur (flag localStorage) pour ne pas repayer ce coût à chaque coup. */
export async function restoreFromCloudIfNeeded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { getAll: (store: SyncableStore) => Promise<Array<{ id: string }>>; put: (store: SyncableStore, value: any) => Promise<unknown> },
): Promise<void> {
  if (localStorage.getItem(RESTORE_FLAG_KEY)) return
  try {
    const grouped = await pullAll()
    for (const store of SYNCABLE_STORES) {
      const remoteRecords = grouped[store]
      if (!remoteRecords || remoteRecords.length === 0) continue
      const localRecords = await db.getAll(store)
      const localIds = new Set(localRecords.map((r) => r.id))
      for (const rec of remoteRecords) {
        if (!localIds.has(rec.id)) await db.put(store, rec.data)
      }
    }
    localStorage.setItem(RESTORE_FLAG_KEY, String(Date.now()))
  } catch {
    // best effort — a failed restore attempt shouldn't block app startup,
    // and we deliberately don't set the flag so it retries next launch
  }
}
