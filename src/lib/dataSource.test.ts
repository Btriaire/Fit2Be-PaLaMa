import { describe, expect, it } from 'vitest'
import { inferSource } from './dataSource'

describe('provenance des données', () => {
  it('utilise le champ source quand il existe', () => expect(inferSource({ source: 'machine-scan', externalId: 'x' })).toBe('machine-scan'))
  it('déduit Google Fit des séances de pas automatiques', () => expect(inferSource({ externalId: 'steps-2026-09-10' })).toBe('googlefit'))
  it('déduit Apple Santé', () => expect(inferSource({ externalId: 'healthkit-AB12' })).toBe('apple-health'))
  it('tout autre id externe vient de NutriTracker', () => expect(inferSource({ externalId: 'abc123' })).toBe('nutritracker'))
  it('sans indice = saisie manuelle', () => expect(inferSource({})).toBe('manual'))
})
