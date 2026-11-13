import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type GpsStatus = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable'

interface Coords {
  lat: number
  lng: number
  accuracy: number
}

interface ReverseGeocode {
  municipality: string | null
  barangay: string | null
}

interface LocationContextValue {
  status: GpsStatus
  coords: Coords | null
  municipality: string | null
  barangay: string | null
  accuracy: number | null
  requestPermission: () => Promise<void>
  startWatching: () => void
  stopWatching: () => void
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined)

const MUNICIPALITIES = [
  'Boac',
  'Buenavista',
  'Gasan',
  'Mogpog',
  'Santa Cruz',
  'Torrijos',
]

// Approximate bounding box of Marinduque — used to validate fixes.
const MARINDUQUE_BBOX = {
  minLat: 13.2,
  maxLat: 13.6,
  minLng: 121.7,
  maxLng: 122.1,
}

// Rough municipality centroids for fallback reverse-geocoding (no external API calls).
const MUNI_CENTROIDS: { name: string; lat: number; lng: number }[] = [
  { name: 'Boac', lat: 13.4667, lng: 121.85 },
  { name: 'Buenavista', lat: 13.4667, lng: 121.9333 },
  { name: 'Gasan', lat: 13.3167, lng: 121.8833 },
  { name: 'Mogpog', lat: 13.4167, lng: 121.8333 },
  { name: 'Santa Cruz', lat: 13.5, lng: 121.9167 },
  { name: 'Torrijos', lat: 13.3, lng: 121.9833 },
]

function nearestMunicipality(lat: number, lng: number): string {
  let best = MUNI_CENTROIDS[0]
  let bestDist = Infinity
  for (const m of MUNI_CENTROIDS) {
    const d = (m.lat - lat) ** 2 + (m.lng - lng) ** 2
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  return best.name
}

function inMarinduque(lat: number, lng: number): boolean {
  return (
    lat >= MARINDUQUE_BBOX.minLat &&
    lat <= MARINDUQUE_BBOX.maxLat &&
    lng >= MARINDUQUE_BBOX.minLng &&
    lng <= MARINDUQUE_BBOX.maxLng
  )
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GpsStatus>('unknown')
  const [coords, setCoords] = useState<Coords | null>(null)
  const [reverse, setReverse] = useState<ReverseGeocode>({
    municipality: null,
    barangay: null,
  })
  const [watchId, setWatchId] = useState<number | null>(null)

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    if (watchId !== null) return

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setCoords({ lat: latitude, lng: longitude, accuracy })
        setStatus('granted')
        if (inMarinduque(latitude, longitude)) {
          setReverse({ municipality: nearestMunicipality(latitude, longitude), barangay: null })
        } else {
          setReverse({ municipality: null, barangay: null })
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus('denied')
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus('unavailable')
        // On timeout, keep the last known status/coords so GPS doesn't flip to "off".
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    setWatchId(id)
  }, [watchId])

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }, [watchId])

  // Stop watching when the provider unmounts.
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  const requestPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    // getCurrentPosition triggers the permission prompt.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setCoords({ lat: latitude, lng: longitude, accuracy })
        setStatus('granted')
        if (inMarinduque(latitude, longitude)) {
          setReverse({ municipality: nearestMunicipality(latitude, longitude), barangay: null })
        } else {
          setReverse({ municipality: null, barangay: null })
        }
        // Start continuous tracking after the user grants permission.
        if (watchId === null) {
          startWatching()
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus('denied')
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus('unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
  }, [watchId, startWatching])

  // Initial permission probe (does not prompt unless state is "prompt").
  useEffect(() => {
    if (!('permissions' in navigator) || !navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (result.state === 'granted') {
          setStatus('granted')
          startWatching()
        } else if (result.state === 'denied') {
          setStatus('denied')
        } else {
          setStatus('prompt')
        }
      })
      .catch(() => setStatus('prompt'))
  }, [startWatching])

  const value = useMemo<LocationContextValue>(
    () => ({
      status,
      coords,
      municipality: reverse.municipality,
      barangay: reverse.barangay,
      accuracy: coords?.accuracy ?? null,
      requestPermission,
      startWatching,
      stopWatching,
    }),
    [status, coords, reverse, requestPermission, startWatching, stopWatching],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used within LocationProvider')
  return ctx
}

export { MUNICIPALITIES }
