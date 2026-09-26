// Durable-storage sync to the small self-hosted server on the VPS — the
// point is to survive a PWA reinstall wiping local IndexedDB (which
// happened), not to be a real-time multi-device sync. Best-effort only:
// every call swallows its own errors so a sync hiccup (offline, VPS
// restart) never blocks the local save that already succeeded.

import { recordSyncResult } from './syncStatus'

/** Une réponse 200 avec `skipped: true` (VPS injoignable, synchro non configurée) compte comme un échec. */
async function trackResult(res: Response) {
  let ok = res.ok
  if (ok) {
    // Corps non JSON (ex: page HTML de repli) = pas la vraie API : échec.
    const body = (await res.json().catch(() => null)) as { skipped?: boolean; ok?: boolean } | null
    if (!body || body.skipped || body.ok === false) ok = false
  }
  recordSyncResult(ok)
}

export const SYNCABLE_STORES = ['workouts', 'activities', 'recovery', 'nutrition', 'weightLogs', 'endurance', 'customTemplates', 'dailyPhotos', 'customEndurancePrograms'] as const
export type SyncableStore = (typeof SYNCABLE_STORES)[number]

export function pushRecord(store: SyncableStore, id: string, data: unknown): void {
  fetch('/api/cloudsync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ store, id, data }),
  })
    .then(trackResult)
    .catch(() => {
      // offline or endpoint unavailable — local save already succeeded
      recordSyncResult(false)
    })
}

/** Pousse le profil (âge, taille, sexe, FC repos...) vers le même serveur de
 * sync — pas un store IndexedDB comme les autres (les réglages vivent en
 * localStorage), donc hors de SYNCABLE_STORES/restoreFromCloudIfNeeded. Sert
 * uniquement à donner au générateur de rapport hebdo (VPS, api/progress-report)
 * de quoi calculer les formules qui ont besoin du profil (VO2max, IMC...). */
export function pushProfileRecord(data: unknown): void {
  fetch('/api/cloudsync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ store: 'profile', id: 'me', data }),
  }).catch(() => {})
}

export function deleteRecord(store: SyncableStore, id: string): void {
  fetch('/api/cloudsync', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ store, id }),
  })
    .then(trackResult)
    .catch(() => {
      recordSyncResult(false)
    })
}

interface CloudRecord {
  id: string
  data: unknown
  updatedAt: number
}

/** null = échec (hors ligne, 401, panne) : on ne doit alors surtout pas considérer la restauration comme faite. */
async function pullAll(): Promise<Partial<Record<SyncableStore, CloudRecord[]>> | null> {
  try {
    const r = await fetch('/api/cloudsync')
    if (!r.ok) return null
    const body = await r.json()
    if (body && (body as { skipped?: boolean }).skipped) return null
    return body
  } catch {
    return null
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
    if (!grouped) return // réessaiera au prochain lancement
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
