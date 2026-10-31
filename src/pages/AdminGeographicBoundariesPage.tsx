import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Lock, MapPin } from 'lucide-react'
import { GeographicBoundaryDetail } from '../components/GeographicBoundaryDetail'
import { GeographicUploadForm } from '../components/GeographicUploadForm'
import { GeographicUploadQueue } from '../components/GeographicUploadQueue'
import {
  fetchAdminBoundaries,
  fetchBoundaryHistory,
  type GeographicBoundary,
  type GeographicHistoryEntry,
} from '../lib/geographicBoundaries'
import { fetchUploadJobs, type UploadJob } from '../lib/geographicUploads'
import { isAlertAdmin } from '../lib/transportAlerts'
import { formatRelativeTime } from '../lib/labels'

const ACTION_TEXT: Record<GeographicHistoryEntry['action'], string> = {
  imported: 'Imported a draft',
  reviewed: 'Reviewed against source',
  published: 'Published',
  archived: 'Archived',
}

export function AdminGeographicBoundariesPage() {
  const [admin, setAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [boundaries, setBoundaries] = useState<GeographicBoundary[]>([])
  const [history, setHistory] = useState<GeographicHistoryEntry[]>([])
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [rows, entries, uploads] = await Promise.all([fetchAdminBoundaries(), fetchBoundaryHistory(), fetchUploadJobs()])
      setBoundaries(rows)
      setHistory(entries)
      setJobs(uploads)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'The datasets could not be loaded.')
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const isAdmin = await isAlertAdmin()
      setAdmin(isAdmin)
      if (isAdmin) await refresh()
      setLoading(false)
    })()
  }, [refresh])

  const selected = boundaries.find((row) => row.id === selectedId) ?? null

  if (loading) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Lock size={24} className="text-ocean-500" />
            <p className="text-base font-bold text-ocean-900">Access Restricted</p>
            <p className="text-sm text-ocean-700">Only authorized administrators can manage geographic boundaries.</p>
            <Link to="/" className="btn-secondary">Back to home</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5">
        {loadError && (
          <p role="alert" className="card text-sm font-semibold text-red-700">{loadError}</p>
        )}

        <GeographicUploadForm
          onSaved={() => {
            void refresh()
          }}
        />

        <GeographicUploadQueue
          jobs={jobs}
          boundaries={boundaries}
          onChanged={() => {
            void refresh()
          }}
        />

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-ocean-900">Datasets and versions</h2>
          {boundaries.length === 0 ? (
            <p className="card text-sm text-ocean-700">No datasets have been imported yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {boundaries.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`card flex w-full items-center justify-between gap-3 text-left transition hover:border-ocean-300 ${
                      row.id === selectedId ? 'ring-2 ring-ocean-500' : ''
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <MapPin size={18} className="shrink-0 text-ocean-500" />
                      <span>
                        <span className="block text-sm font-bold text-ocean-900">
                          {row.label} · version {row.version}
                        </span>
                        <span className="block text-xs text-ocean-700">
                          {row.boundary_key} · {row.status} · {row.verification_status}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected && (
          <GeographicBoundaryDetail
            key={selected.id}
            boundary={selected}
            onChanged={() => {
              void refresh()
            }}
          />
        )}

        <section className="card flex flex-col gap-3">
          <h2 className="text-base font-bold text-ocean-900">History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-ocean-700">No changes recorded yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ocean-100">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-semibold text-ocean-800">{ACTION_TEXT[entry.action]}</span>
                  <span className="text-xs text-ocean-600">{formatRelativeTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )

  function Header() {
    return (
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Geographic Boundaries</h1>
        </div>
      </header>
    )
  }
}
