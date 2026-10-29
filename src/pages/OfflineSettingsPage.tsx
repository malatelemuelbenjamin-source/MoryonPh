import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  HardDrive,
  Info,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { useOffline, DATASET_LABELS, type DatasetKey } from '../lib/offline'
import { MUNICIPALITIES } from '../lib/explore'
import { formatRelativeTime } from '../lib/labels'

const DOWNLOADABLE_DATASETS: DatasetKey[] = [
  'routes', 'route_stops', 'fares', 'fare_rules',
  'fare_matrices', 'fare_matrix_entries', 'locations', 'transport_modes',
  'emergency_contacts', 'emergency_guides', 'destinations', 'ports',
  'tricycle_service_areas',
]

export function OfflineSettingsPage() {
  const offline = useOffline()
  const [muniFilter, setMuniFilter] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<DatasetKey | null>(null)
  const [downloadMsg, setDownloadMsg] = useState<{ key: DatasetKey; success: boolean; error?: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const handleDownload = useCallback(async (key: DatasetKey) => {
    setDownloading(key)
    setDownloadMsg(null)
    const res = await offline.downloadDataset(key, muniFilter)
    setDownloading(null)
    setDownloadMsg({ key, ...res })
  }, [offline, muniFilter])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncResult(null)
    const res = await offline.syncAll()
    setSyncing(false)
    setSyncResult(res)
  }, [offline])

  const handleClear = useCallback(async () => {
    await offline.clearAllCached()
    setConfirmClear(false)
  }, [offline])

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const totalSize = offline.downloadedDatasets.reduce((sum, d) => sum + (d.sizeBytes ?? 0), 0)

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ocean-600">
            <Database size={18} />
          </span>
          <h1 className="text-lg font-bold">Offline Settings</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Connection status */}
        <section className="card space-y-2">
          <div className="flex items-center gap-2">
            {offline.status === 'online' && <Wifi size={20} className="text-leaf-600" />}
            {offline.status === 'slow' && <Wifi size={20} className="text-terra-600" />}
            {offline.status === 'reconnecting' && <Loader2 size={20} className="animate-spin text-ocean-600" />}
            {offline.status === 'offline' && <WifiOff size={20} className="text-red-600" />}
            <div className="flex-1">
              <p className="font-bold text-ocean-900">
                {offline.status === 'online' && 'Online'}
                {offline.status === 'slow' && 'Slow Connection'}
                {offline.status === 'reconnecting' && 'Reconnecting…'}
                {offline.status === 'offline' && 'Offline'}
              </p>
              <p className="text-xs text-ocean-500">
                {offline.lastSyncAt
                  ? `Last synced ${formatRelativeTime(offline.lastSyncAt)}`
                  : 'Never synced'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void offline.refreshStatus()}
              className="grid h-9 w-9 place-items-center rounded-full bg-ocean-50 text-ocean-600 hover:bg-ocean-100"
              aria-label="Refresh status"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {offline.status === 'offline' && (
            <p className="text-xs text-red-600 font-medium">
              You are offline. Downloaded data is still available — look for the "Cached" label on available screens.
            </p>
          )}
          {offline.status === 'slow' && (
            <p className="text-xs text-terra-600 font-medium">
              Your connection is slow. Some features may take longer than usual.
            </p>
          )}
        </section>

        {/* Sync all */}
        <section className="card flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || offline.status === 'offline' || offline.downloadedDatasets.length === 0}
            className="btn-primary flex-1 text-sm"
          >
            {syncing ? (
              <><Loader2 size={14} className="animate-spin" /> Syncing…</>
            ) : (
              <><RefreshCw size={14} /> Sync All Datasets</>
            )}
          </button>
        </section>
        {syncResult && (
          <div className={`rounded-lg px-3 py-2 text-sm ${syncResult.failed === 0 ? 'bg-leaf-50 text-leaf-700' : 'bg-terra-50 text-terra-700'}`}>
            Synced {syncResult.synced} dataset(s){syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}.
          </div>
        )}

        {/* Storage usage */}
        <section className="card space-y-2">
          <h2 className="section-title flex items-center gap-1.5">
            <HardDrive size={16} /> Storage Usage
          </h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ocean-600">Total downloaded</span>
            <span className="font-bold text-ocean-900">{formatBytes(totalSize)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ocean-600">Datasets cached</span>
            <span className="font-bold text-ocean-900">{offline.downloadedDatasets.length}</span>
          </div>
        </section>

        {/* Municipality selector for downloads */}
        <section className="card space-y-2">
          <p className="text-xs font-semibold text-ocean-700">Download Scope</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMuniFilter(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                muniFilter === null ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
              }`}
            >
              All Municipalities
            </button>
            {MUNICIPALITIES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMuniFilter(m)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  muniFilter === m ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </section>

        {/* Downloadable datasets */}
        <section className="space-y-2">
          <h2 className="section-title">Download for Offline Use</h2>

          {/* Already downloaded */}
          {offline.downloadedDatasets.length > 0 && (
            <div className="space-y-2">
              {offline.downloadedDatasets.map((ds) => (
                <div key={`${ds.key}-${ds.municipality}`} className="card flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-leaf-100 text-leaf-700">
                    <CheckCircle2 size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ocean-900 text-sm">{DATASET_LABELS[ds.key] ?? ds.key}</p>
                    <p className="text-xs text-ocean-500">
                      {ds.municipality ?? 'All'} • {ds.records.length} records • {formatBytes(ds.sizeBytes)}
                    </p>
                    <p className="text-xs text-ocean-400 flex items-center gap-1">
                      <Clock size={10} /> Downloaded {formatRelativeTime(ds.downloadedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void offline.removeDataset(ds.key, ds.municipality)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                    aria-label="Remove download"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Available to download */}
          <div className="space-y-2">
            {DOWNLOADABLE_DATASETS.filter((k) => {
              const isDownloaded = offline.downloadedDatasets.some(
                (d) => d.key === k && (d.municipality ?? null) === (muniFilter ?? null),
              )
              return !isDownloaded
            }).map((key) => (
              <div key={key} className="card flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ocean-50 text-ocean-600">
                  <Download size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ocean-900 text-sm">{DATASET_LABELS[key] ?? key}</p>
                  <p className="text-xs text-ocean-500">{muniFilter ?? 'All municipalities'}</p>
                </div>
                {downloading === key ? (
                  <Loader2 size={18} className="animate-spin text-ocean-600" />
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleDownload(key)}
                    disabled={offline.status === 'offline' || downloading !== null}
                    className="flex items-center gap-1 rounded-full bg-ocean-700 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 hover:bg-ocean-600 disabled:opacity-40"
                  >
                    <Download size={12} /> Download
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Download result message */}
          {downloadMsg && (
            <div className={`rounded-lg px-3 py-2 text-sm ${
              downloadMsg.success ? 'bg-leaf-50 text-leaf-700' : 'bg-red-50 text-red-700'
            }`}>
              {downloadMsg.success ? (
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> {DATASET_LABELS[downloadMsg.key]} downloaded successfully.</span>
              ) : (
                <span className="flex items-center gap-1.5"><XCircle size={14} /> {downloadMsg.error ?? 'Download failed.'}</span>
              )}
            </div>
          )}
        </section>

        {/* Clear all */}
        <section className="card space-y-3">
          <h2 className="section-title flex items-center gap-1.5">
            <AlertTriangle size={16} className="text-red-600" /> Danger Zone
          </h2>
          <p className="text-xs text-ocean-600">
            Remove all downloaded datasets from this device. Your account and server-side data are not affected.
          </p>
          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={offline.downloadedDatasets.length === 0}
              className="btn-secondary w-full text-sm text-red-700 border-red-200"
            >
              <Trash2 size={14} /> Clear All Downloads
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-700">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleClear()} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
                  Yes, Clear All
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="flex-1 rounded-xl bg-ocean-50 px-4 py-2 text-sm font-semibold text-ocean-700">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Info */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <div className="space-y-1 text-xs text-ocean-600">
            <p>
              Downloaded data is stored locally on your device using IndexedDB and persists after the app is closed.
              When you're offline, cached routes, fares, places, and emergency information remain accessible.
            </p>
            <p className="font-semibold text-ocean-700">What works offline:</p>
            <ul className="ml-3 list-disc space-y-0.5">
              <li>Saved routes and saved places</li>
              <li>Downloaded fare rules and fare matrices</li>
              <li>Cached routes, route stops, and transport modes</li>
              <li>Cached emergency contacts and safety guides</li>
              <li>Cached nearby places and destinations</li>
            </ul>
            <p className="font-semibold text-ocean-700">What requires internet:</p>
            <ul className="ml-3 list-disc space-y-0.5">
              <li>Real-time fare updates and transport alerts</li>
              <li>Mory AI chat (unless Python service is running locally)</li>
              <li>New searches against the full Supabase database</li>
              <li>Submitting reports and community suggestions</li>
              <li>Weather data (unless cached)</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}
