import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapLocation } from '../lib/transportMap'

interface LeafletMapViewProps {
  locations: MapLocation[]
  selectedLocation: MapLocation | null
  onSelect: (loc: MapLocation) => void
  gpsCoords: { lat: number; lng: number } | null
}

const MARINDUQUE_CENTER: [number, number] = [13.4111, 121.9]

function locationIcon(type: string): L.DivIcon {
  const colors: Record<string, string> = {
    port: '#0d6e6e',
    terminal: '#155571',
    tourist_destination: '#c2602e',
    default: '#155571',
  }
  const color = colors[type] ?? colors.default
  return L.divIcon({
    className: 'moryongo-map-marker',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700">${type.charAt(0).toUpperCase()}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

const gpsIcon = L.divIcon({
  className: 'moryongo-gps-marker',
  html: `<div style="background:#2d9b3a;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(45,155,58,.3)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

export function LeafletMapView({ locations, selectedLocation, onSelect, gpsCoords }: LeafletMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const gpsMarkerRef = useRef<L.Marker | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    try {
      const map = L.map(containerRef.current, {
        center: MARINDUQUE_CENTER,
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
      setStatus('ready')
    } catch {
      setStatus('error')
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    for (const loc of locations) {
      if (loc.latitude == null || loc.longitude == null) continue
      const marker = L.marker([loc.latitude, loc.longitude], { icon: locationIcon(loc.type), title: loc.name })
        .addTo(map)
        .bindPopup(`<strong>${loc.name}</strong><br/><span style="font-size:11px;color:#666">${loc.municipality ?? ''}</span>`)
      marker.on('click', () => onSelect(loc))
      markersRef.current.push(marker)
    }
  }, [locations, status, onSelect])

  useEffect(() => {
    if (!selectedLocation || selectedLocation.latitude == null || selectedLocation.longitude == null) return
    const map = mapRef.current
    if (!map) return
    map.panTo([selectedLocation.latitude, selectedLocation.longitude])
  }, [selectedLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return

    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.remove()
      gpsMarkerRef.current = null
    }

    if (gpsCoords) {
      gpsMarkerRef.current = L.marker([gpsCoords.lat, gpsCoords.lng], { icon: gpsIcon })
        .addTo(map)
        .bindPopup('Your location')
      map.panTo([gpsCoords.lat, gpsCoords.lng])
    }
  }, [gpsCoords, status])

  if (status === 'error') {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-xl bg-ocean-50 p-4 text-center">
        <AlertCircle size={24} className="text-terra-600" />
        <p className="text-sm font-semibold text-ocean-700">The map could not load. Check your connection.</p>
        <p className="text-xs text-ocean-500">The 2D grid and 3D globe views are still available.</p>
      </div>
    )
  }

  return (
    <div className="relative h-80 overflow-hidden rounded-xl">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ocean-50">
          <Loader2 size={20} className="animate-spin text-ocean-500" />
          <span className="ml-2 text-sm text-ocean-600">Loading map…</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-2 left-2 z-[500] rounded-lg bg-white/90 px-2 py-1 text-xs text-ocean-600">
        Marinduque · {locations.length} locations
      </div>
    </div>
  )
}
