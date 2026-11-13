import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { MapLocation } from '../lib/transportMap'
import { loadGoogleMapsApi } from '../lib/googleMaps'

interface GoogleMapsViewProps {
  locations: MapLocation[]
  selectedLocation: MapLocation | null
  onSelect: (loc: MapLocation) => void
  gpsCoords: { lat: number; lng: number } | null
}

const MARINDUQUE_CENTER = { lat: 13.4111, lng: 121.9 }

function locationIconLabel(type: string): string {
  switch (type) {
    case 'port': return 'P'
    case 'terminal': return 'T'
    case 'tourist_destination': return 'D'
    default: return 'L'
  }
}

export function GoogleMapsView({ locations, selectedLocation, onSelect, gpsCoords }: GoogleMapsViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const gpsMarkerRef = useRef<google.maps.Marker | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('Google Maps could not load. Check your connection.')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await loadGoogleMapsApi()
        if (cancelled || !containerRef.current || mapRef.current) return
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: MARINDUQUE_CENTER,
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
          ],
        })
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMsg(err instanceof Error ? err.message : 'Google Maps could not load.')
        setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    for (const loc of locations) {
      if (loc.latitude == null || loc.longitude == null) continue
      const marker = new google.maps.Marker({
        position: { lat: loc.latitude, lng: loc.longitude },
        map,
        title: loc.name,
        label: {
          text: locationIconLabel(loc.type),
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#ffffff',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#155571',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
      marker.addListener('click', () => onSelect(loc))
      markersRef.current.push(marker)
    }
  }, [locations, status, onSelect])

  useEffect(() => {
    if (!selectedLocation || selectedLocation.latitude == null || selectedLocation.longitude == null) return
    const map = mapRef.current
    if (!map) return
    map.panTo({ lat: selectedLocation.latitude, lng: selectedLocation.longitude })
  }, [selectedLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return

    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setMap(null)
      gpsMarkerRef.current = null
    }

    if (gpsCoords) {
      gpsMarkerRef.current = new google.maps.Marker({
        position: gpsCoords,
        map,
        title: 'Your location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#2d9b3a',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      })
      map.panTo(gpsCoords)
    }
  }, [gpsCoords, status])

  if (status === 'error') {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-xl bg-ocean-50 p-4 text-center">
        <AlertCircle size={24} className="text-terra-600" />
        <p className="text-sm font-semibold text-ocean-700">{errorMsg}</p>
        <p className="text-xs text-ocean-500">The 2D grid and 3D globe views are still available.</p>
      </div>
    )
  }

  return (
    <div className="relative h-80 overflow-hidden rounded-xl">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ocean-50">
          <Loader2 size={20} className="animate-spin text-ocean-500" />
          <span className="ml-2 text-sm text-ocean-600">Loading Google Maps…</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1 text-xs text-ocean-600">
        Marinduque · {locations.length} locations
      </div>
    </div>
  )
}
