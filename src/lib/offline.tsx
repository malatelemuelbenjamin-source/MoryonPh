import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'online' | 'slow' | 'reconnecting' | 'offline'

export type DatasetKey =
  | 'routes' | 'route_stops' | 'fares' | 'fare_rules'
  | 'fare_matrices' | 'fare_matrix_entries' | 'locations' | 'transport_modes'
  | 'emergency_contacts' | 'emergency_guides' | 'destinations' | 'ports'
  | 'tricycle_service_areas'

export interface CachedDataset {
  key: DatasetKey
  municipality: string | null
  records: unknown[]
  downloadedAt: string
  version: number | null
  sizeBytes: number
}

export interface DatasetMeta {
  key: DatasetKey
  label: string
  description: string
  records: number
  version: number
  published_at: string
  last_verified_at: string | null
}

interface OfflineContextValue {
  status: ConnectionStatus
  lastSyncAt: string | null
  downloadedDatasets: CachedDataset[]
  refreshStatus: () => void
  downloadDataset: (key: DatasetKey, municipality?: string | null) => Promise<{ success: boolean; error?: string }>
  removeDataset: (key: DatasetKey, municipality?: string | null) => Promise<void>
  clearAllCached: () => Promise<void>
  getCached: <T = unknown>(key: DatasetKey, municipality?: string | null) => Promise<T[]>
  getDatasetMeta: () => Promise<DatasetMeta[]>
  syncAll: () => Promise<{ synced: number; failed: number }>
}

const SLOW_THRESHOLD_MS = 5000
const DB_NAME = 'moryongo-offline'
const DB_VERSION = 1
const STORE_CACHE = 'datasets'
const STORE_META = 'meta'

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE, { keyPath: 'cacheKey' })
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function cacheKey(key: DatasetKey, municipality?: string | null): string {
  return `${key}::${municipality ?? '_all'}`
}

async function idbPut(store: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbClear(store: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------------------------------------------------------------------------
// Dataset fetchers
// ---------------------------------------------------------------------------

const DATASET_FETCHERS: Record<DatasetKey, (municipality?: string | null) => Promise<{ data: unknown[]; table: string }>> = {
  routes: async (muni) => {
    let q = supabase.from('routes').select('*').eq('route_status', 'active').in('verification_status', ['official', 'verified'])
    if (muni) q = q.eq('municipality', muni)
    const { data } = await q.limit(200)
    return { data: data ?? [], table: 'routes' }
  },
  route_stops: async () => {
    const { data } = await supabase.from('route_stops').select('*').limit(500)
    return { data: data ?? [], table: 'route_stops' }
  },
  fares: async () => {
    const { data } = await supabase.from('fares').select('*').in('verification_status', ['official', 'verified']).limit(200)
    return { data: data ?? [], table: 'fares' }
  },
  fare_rules: async () => {
    const { data } = await supabase.from('fare_rules').select('*').limit(200)
    return { data: data ?? [], table: 'fare_rules' }
  },
  fare_matrices: async () => {
    const { data } = await supabase.from('fare_matrices').select('*').limit(100)
    return { data: data ?? [], table: 'fare_matrices' }
  },
  fare_matrix_entries: async () => {
    const { data } = await supabase.from('fare_matrix_entries').select('*').limit(500)
    return { data: data ?? [], table: 'fare_matrix_entries' }
  },
  locations: async (muni) => {
    let q = supabase.from('locations').select('*').in('verification_status', ['official', 'verified', 'community'])
    if (muni) q = q.eq('municipality', muni)
    const { data } = await q.limit(500)
    return { data: data ?? [], table: 'locations' }
  },
  transport_modes: async () => {
    const { data } = await supabase.from('transport_modes').select('*').eq('is_active', true)
    return { data: data ?? [], table: 'transport_modes' }
  },
  emergency_contacts: async (muni) => {
    let q = supabase.from('emergency_contacts').select('*').eq('is_published', true).in('verification_status', ['official', 'verified'])
    if (muni) q = q.or(`municipality.eq.${muni},municipality.is.null`)
    const { data } = await q.limit(100)
    return { data: data ?? [], table: 'emergency_contacts' }
  },
  emergency_guides: async (muni) => {
    let q = supabase.from('emergency_guides').select('*').eq('is_published', true).in('verification_status', ['official', 'verified'])
    if (muni) q = q.or(`municipality.eq.${muni},municipality.is.null`)
    const { data } = await q.limit(100)
    return { data: data ?? [], table: 'emergency_guides' }
  },
  destinations: async (muni) => {
    let q = supabase.from('destinations').select('*').eq('is_published', true)
    if (muni) q = q.eq('municipality', muni)
    const { data } = await q.limit(200)
    return { data: data ?? [], table: 'destinations' }
  },
  ports: async () => {
    const { data } = await supabase.from('ports').select('*').in('verification_status', ['official', 'verified']).limit(50)
    return { data: data ?? [], table: 'ports' }
  },
  tricycle_service_areas: async () => {
    const { data } = await supabase.from('tricycle_service_areas').select('*').in('verification_status', ['official', 'verified']).limit(50)
    return { data: data ?? [], table: 'tricycle_service_areas' }
  },
}

export const DATASET_LABELS: Record<DatasetKey, string> = {
  routes: 'Routes',
  route_stops: 'Route Stops',
  fares: 'Fares',
  fare_rules: 'Fare Rules',
  fare_matrices: 'Fare Matrices',
  fare_matrix_entries: 'Fare Matrix Entries',
  locations: 'Locations & Places',
  transport_modes: 'Transport Modes',
  emergency_contacts: 'Emergency Contacts',
  emergency_guides: 'Safety Guides',
  destinations: 'Destinations',
  ports: 'Ports',
  tricycle_service_areas: 'Tricycle Service Areas',
}

// ---------------------------------------------------------------------------
// Connection check
// ---------------------------------------------------------------------------

async function checkConnection(): Promise<ConnectionStatus> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  try {
    const start = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SLOW_THRESHOLD_MS)
    const { error, count } = await supabase
      .from('transport_modes')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    clearTimeout(timeout)
    const elapsed = Date.now() - start
    if (error || count === null) return 'offline'
    return elapsed > 3000 ? 'slow' : 'online'
  } catch {
    return 'offline'
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('online')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [downloadedDatasets, setDownloadedDatasets] = useState<CachedDataset[]>([])
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load meta from IndexedDB on mount
  useEffect(() => {
    void (async () => {
      const cached = await idbGetAll<CachedDataset>(STORE_CACHE)
      setDownloadedDatasets(cached)
      const meta = await idbGet<string>(STORE_META, 'lastSync')
      if (meta) setLastSyncAt(meta)
    })()
  }, [])

  // Network event listeners
  const refreshStatus = useCallback(async () => {
    const s = await checkConnection()
    setStatus(s)
    if (s === 'offline' || s === 'slow') {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(() => void refreshStatus(), 15000)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    const onOnline = () => { setStatus('reconnecting'); void refreshStatus() }
    const onOffline = () => setStatus('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const interval = setInterval(() => void refreshStatus(), 60000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [refreshStatus])

  // Download a dataset
  const downloadDataset = useCallback(async (key: DatasetKey, municipality: string | null = null): Promise<{ success: boolean; error?: string }> => {
    try {
      const fetcher = DATASET_FETCHERS[key]
      if (!fetcher) return { success: false, error: 'Unknown dataset.' }
      const { data } = await fetcher(municipality)
      const sizeBytes = JSON.stringify(data).length
      const cached: CachedDataset = {
        key,
        municipality,
        records: data,
        downloadedAt: new Date().toISOString(),
        version: null,
        sizeBytes,
      }
      // Try to get version from server
      try {
        const { data: vData } = await supabase
          .from('offline_dataset_versions')
          .select('version_number')
          .eq('dataset_key', key)
          .eq('is_published', true)
          .maybeSingle()
        if (vData) cached.version = (vData as { version_number: number }).version_number
      } catch { /* version optional */ }

      const ck = cacheKey(key, municipality)
      await idbPut(STORE_CACHE, { ...cached, cacheKey: ck })
      const all = await idbGetAll<CachedDataset>(STORE_CACHE)
      setDownloadedDatasets(all)
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed.'
      return { success: false, error: msg }
    }
  }, [])

  // Remove a dataset
  const removeDataset = useCallback(async (key: DatasetKey, municipality: string | null = null) => {
    const ck = cacheKey(key, municipality)
    await idbDelete(STORE_CACHE, ck)
    const all = await idbGetAll<CachedDataset>(STORE_CACHE)
    setDownloadedDatasets(all)
  }, [])

  // Clear all cached
  const clearAllCached = useCallback(async () => {
    await idbClear(STORE_CACHE)
    setDownloadedDatasets([])
  }, [])

  // Get cached records
  const getCached = useCallback(async <T = unknown>(key: DatasetKey, municipality: string | null = null): Promise<T[]> => {
    const ck = cacheKey(key, municipality)
    const cached = await idbGet<CachedDataset>(STORE_CACHE, ck)
    return (cached?.records ?? []) as T[]
  }, [])

  // Get server dataset metadata
  const getDatasetMeta = useCallback(async (): Promise<DatasetMeta[]> => {
    const { data } = await supabase
      .from('offline_dataset_versions')
      .select('*')
      .eq('is_published', true)
      .order('dataset_key', { ascending: true })
    return (data ?? []) as DatasetMeta[]
  }, [])

  // Sync all downloaded datasets
  const syncAll = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    let synced = 0
    let failed = 0
    const conn = await checkConnection()
    if (conn === 'offline') return { synced: 0, failed: 0 }

    for (const ds of downloadedDatasets) {
      const res = await downloadDataset(ds.key, ds.municipality)
      if (res.success) synced++
      else failed++
    }

    const now = new Date().toISOString()
    setLastSyncAt(now)
    await idbPut(STORE_META, { key: 'lastSync', value: now })
    return { synced, failed }
  }, [downloadedDatasets, downloadDataset])

  const value = useMemo<OfflineContextValue>(
    () => ({
      status,
      lastSyncAt,
      downloadedDatasets,
      refreshStatus,
      downloadDataset,
      removeDataset,
      clearAllCached,
      getCached,
      getDatasetMeta,
      syncAll,
    }),
    [status, lastSyncAt, downloadedDatasets, refreshStatus, downloadDataset, removeDataset, clearAllCached, getCached, getDatasetMeta, syncAll],
  )

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
}

export function useOffline() {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider')
  return ctx
}
