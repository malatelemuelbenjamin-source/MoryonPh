import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import { reverseGeocode, detectMunicipality, inMarinduqueBbox } from './reverseGeocode'

export type GpsStatus = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable'

interface Coords {
  lat: number
  lng: number
  accuracy: number
}

interface ReverseGeocode {
  municipality: string | null
  barangay: string | null
  area: string | null
}

interface LocationContextValue {
  status: GpsStatus
  coords: Coords | null
  municipality: string | null
  barangay: string | null
  area: string | null
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

async function resolveLocation(lat: number, lng: number): Promise<ReverseGeocode> {
  if (inMarinduqueBbox(lat, lng)) {
    return reverseGeocode(lat, lng)
  }
  return { municipality: null, barangay: null, area: null }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GpsStatus>('unknown')
  const [coords, setCoords] = useState<Coords | null>(null)
  const [reverse, setReverse] = useState<ReverseGeocode>({
    municipality: null,
    barangay: null,
    area: null,
  })
  const [watchId, setWatchId] = useState<number | null>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateLocation = useCallback(async (lat: number, lng: number, accuracy: number) => {
    setCoords({ lat, lng, accuracy })
    setStatus('granted')
    const result = await resolveLocation(lat, lng)
    setReverse(result)
  }, [])

  const scheduleGeocode = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      setCoords({ lat, lng, accuracy })
      setStatus('granted')

      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
      geocodeTimerRef.current = setTimeout(() => {
        void (async () => {
          const result = await resolveLocation(lat, lng)
          if (result.municipality || result.barangay || result.area) {
            setReverse(result)
          }
        })()
      }, 1500)
    },
    [],
  )

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    if (watchId !== null) return

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        scheduleGeocode(latitude, longitude, accuracy)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus('denied')
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus('unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    setWatchId(id)
  }, [watchId, scheduleGeocode])

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }, [watchId])

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current)
      }
    }
  }, [watchId])

  const requestPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        await updateLocation(latitude, longitude, accuracy)
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
  }, [watchId, startWatching, updateLocation])

  const { user } = useAuth()
  useEffect(() => {
    if (user && status === 'prompt') {
      void requestPermission()
    }
  }, [user, status, requestPermission])

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
      area: reverse.area,
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

export { MUNICIPALITIES, detectMunicipality }
