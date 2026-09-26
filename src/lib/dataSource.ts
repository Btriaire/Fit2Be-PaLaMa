import type { DataSource } from '../types'

export const SOURCE_LABEL: Record<DataSource, string> = {
  manual: 'Saisie manuelle',
  googlefit: 'Google Fit',
  nutritracker: 'NutriTracker',
  'apple-health': 'Apple Santé',
  'machine-scan': 'Scan machine',
}

/** Provenance d'un enregistrement — déduite de l'externalId pour les données antérieures au champ `source`. */
export function inferSource(item: { source?: DataSource; externalId?: string }): DataSource {
  if (item.source) return item.source
  if (item.externalId?.startsWith('steps-')) return 'googlefit'
  if (item.externalId?.startsWith('healthkit-')) return 'apple-health'
  if (item.externalId) return 'nutritracker'
  return 'manual'
}
