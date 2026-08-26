import type { RoutePoint } from '../types'

/** Distance entre deux points GPS (formule de Haversine), en km. */
export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Distance cumulée d'un tracé GPS, en km. */
export function routeDistanceKm(route: RoutePoint[]): number {
  let total = 0
  for (let i = 1; i < route.length; i++) {
    total += haversineKm(route[i - 1], route[i])
  }
  return total
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}
