// Mémorise, par template (chef musculaire ou personnalisé), les exercices
// décochés la dernière fois qu'on l'a démarré — sinon chaque réutilisation
// reproposait tout, y compris ce qu'on avait explicitement retiré la fois
// d'avant.

const PREFIX = 'fit2be:templateExclusions:'

export function getLastExclusions(templateId: string): Set<string> {
  try {
    const raw = localStorage.getItem(PREFIX + templateId)
    if (!raw) return new Set()
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? new Set(ids) : new Set()
  } catch {
    return new Set()
  }
}

export function saveLastExclusions(templateId: string, excluded: Set<string>): void {
  try {
    localStorage.setItem(PREFIX + templateId, JSON.stringify([...excluded]))
  } catch {
    // stockage indisponible (mode privé, quota) — pas bloquant, juste pas de mémorisation
  }
}
