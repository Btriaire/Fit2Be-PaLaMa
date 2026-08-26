import { useCallback, useRef, useState } from 'react'
import { routeDistanceKm } from './geo'
import type { RoutePoint } from '../types'

export interface GeoTrackingState {
  tracking: boolean
  route: RoutePoint[]
  distanceKm: number
  elapsedSec: number
  error: string | null
}

export function useGeoTracking() {
  const [state, setState] = useState<GeoTrackingState>({
    tracking: false,
    route: [],
    distanceKm: 0,
    elapsedSec: 0,
    error: null,
  })
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'Géolocalisation non supportée sur cet appareil.' }))
      return
    }
    startedAtRef.current = Date.now()
    setState({ tracking: true, route: [], distanceKm: 0, elapsedSec: 0, error: null })

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: RoutePoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() }
        setState((s) => {
          const route = [...s.route, point]
          return { ...s, route, distanceKm: routeDistanceKm(route) }
        })
      },
      () => {
        setState((s) => ({ ...s, error: "Impossible d'accéder à ta position — vérifie les permissions." }))
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )

    intervalRef.current = window.setInterval(() => {
      setState((s) => ({ ...s, elapsedSec: Math.round((Date.now() - startedAtRef.current) / 1000) }))
    }, 1000)
  }, [])

  const stop = useCallback((): GeoTrackingState => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    watchIdRef.current = null
    intervalRef.current = null
    let finalState: GeoTrackingState = state
    setState((s) => {
      finalState = { ...s, tracking: false }
      return finalState
    })
    return { ...state, tracking: false }
  }, [state])

  return { ...state, start, stop }
}
