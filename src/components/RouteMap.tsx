import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RoutePoint } from '../types'

interface Props {
  route: RoutePoint[]
  color?: string
  className?: string
  live?: boolean
}

export default function RouteMap({ route, color = '#2dd4bf', className = 'h-48 w-full', live = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: !live,
      scrollWheelZoom: false,
      touchZoom: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || route.length === 0) return
    const latlngs = route.map((p) => [p.lat, p.lng] as [number, number])

    if (lineRef.current) {
      lineRef.current.setLatLngs(latlngs)
    } else {
      lineRef.current = L.polyline(latlngs, { color, weight: 4, opacity: 0.9, lineJoin: 'round' }).addTo(map)
    }

    const last = latlngs[latlngs.length - 1]
    if (live) {
      if (markerRef.current) {
        markerRef.current.setLatLng(last)
      } else {
        markerRef.current = L.circleMarker(last, {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(map)
      }
      map.setView(last, Math.max(map.getZoom() || 15, 15))
    } else {
      map.fitBounds(lineRef.current.getBounds(), { padding: [20, 20] })
    }
  }, [route, color, live])

  return <div ref={containerRef} className={`${className} rounded-xl overflow-hidden`} />
}
