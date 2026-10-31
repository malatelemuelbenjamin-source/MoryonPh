import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Lock, MapPin } from 'lucide-react'
import { MunicipalityAdminPanel } from '../components/MunicipalityAdminPanel'
import { fetchAdminBoundaries, type GeographicBoundary } from '../lib/geographicBoundaries'
import {
  fetchMunicipalityRecords,
  MUNICIPAL_BOUNDARY_KIND,
  type MunicipalityRecord,
} from '../lib/municipalities'
import { isAlertAdmin } from '../lib/transportAlerts'

function describeBoundary(versions: GeographicBoundary[]): string {
  const published = versions.find((version) => version.status === 'published')
  if (published) return `Published version ${published.version}`
  if (versions.some((version) => version.status === 'draft' && version.verification_status === 'verified')) {
    return 'Verified draft ready to publish'
  }
  if (versions.some((version) => version.status === 'draft')) return 'Draft waiting for verification'
  return 'No boundary uploaded yet'
}

function PageHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Municipalities</h1>
      </div>
    </header>
  )
}

export function AdminMunicipalitiesPage() {
  const [admin, setAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [records, setRecords] = useState<MunicipalityRecord[]>([])
  const [boundaries, setBoundaries] = useState<GeographicBoundary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [rows, all] = await Promise.all([fetchMunicipalityRecords(), fetchAdminBoundaries()])
      setRecords(rows)
      setBoundaries(all.filter((row) => row.kind === MUNICIPAL_BOUNDARY_KIND))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'The municipalities could not be loaded.')
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

  if (loading) {
    return (
      <div className="app-shell">
        <PageHeader />
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
        <PageHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Lock size={24} className="text-ocean-500" />
            <p className="text-base font-bold text-ocean-900">Access Restricted</p>
            <p className="text-sm text-ocean-700">Only authorized administrators can manage municipalities.</p>
            <Link to="/" className="btn-secondary">Back to home</Link>
          </div>
        </main>
      </div>
    )
  }

  const selected = records.find((record) => record.id === selectedId) ?? null

  return (
    <div className="app-shell">
      <PageHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5">
        {loadError && <p role="alert" className="card text-sm font-semibold text-red-700">{loadError}</p>}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-ocean-900">The six municipalities</h2>
          {records.length === 0 ? (
            <p className="card text-sm text-ocean-700">No municipalities are listed yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {records.map((record) => {
                const versions = boundaries.filter((row) => row.boundary_key === record.boundary_key)
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      aria-pressed={record.id === selectedId}
                      onClick={() => setSelectedId(record.id)}
                      className={`card flex h-full w-full items-start gap-3 text-left transition hover:border-ocean-300 ${
                        record.id === selectedId ? 'ring-2 ring-ocean-500' : ''
                      }`}
                    >
                      <MapPin size={18} className="mt-0.5 shrink-0 text-ocean-500" />
                      <span className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-ocean-900">{record.name}</span>
                        <span className="text-xs text-ocean-700">
                          Details: {record.details_verification_status === 'verified' ? 'verified' : 'not verified'}
                        </span>
                        <span className="text-xs text-ocean-700">Boundary: {describeBoundary(versions)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {selected && (
          <MunicipalityAdminPanel
            key={selected.id}
            record={selected}
            versions={boundaries.filter((row) => row.boundary_key === selected.boundary_key)}
            onChanged={() => {
              void refresh()
            }}
          />
        )}
      </main>
    </div>
  )
}
