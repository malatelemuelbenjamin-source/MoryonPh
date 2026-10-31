import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { RoadImportPanel } from '../components/RoadImportPanel'
import { RoadVersionList } from '../components/RoadVersionList'
import { loadMunicipalityDirectory, type MunicipalityEntry } from '../lib/municipalities'
import { fetchRoadVersions, type RoadDatasetVersion } from '../lib/roadNetwork'
import { isAlertAdmin } from '../lib/transportAlerts'

export function AdminRoadNetworkPage() {
  const [admin, setAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [versions, setVersions] = useState<RoadDatasetVersion[]>([])
  const [municipalities, setMunicipalities] = useState<MunicipalityEntry[]>([])

  const refresh = useCallback(async () => {
    try {
      const [rows, directory] = await Promise.all([fetchRoadVersions(), loadMunicipalityDirectory()])
      setVersions(rows)
      setMunicipalities(directory)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'The road versions could not be loaded.')
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
        <RoadPageHeader />
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
        <RoadPageHeader />
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-3 text-center">
            <Lock size={24} className="text-ocean-500" />
            <p className="text-base font-bold text-ocean-900">Access Restricted</p>
            <p className="text-sm text-ocean-700">Only authorized administrators can manage the road network.</p>
            <Link to="/" className="btn-secondary">Back to home</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <RoadPageHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5">
        {loadError && (
          <p role="alert" className="card text-sm font-semibold text-red-700">{loadError}</p>
        )}

        <RoadImportPanel onImported={() => void refresh()} />

        <RoadVersionList
          versions={versions}
          municipalities={municipalities}
          onChanged={() => void refresh()}
        />
      </main>
    </div>
  )
}

function RoadPageHeader() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Road Network</h1>
      </div>
    </header>
  )
}
