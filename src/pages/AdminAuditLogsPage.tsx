import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  History,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isAlertAdmin } from '../lib/transportAlerts'
import { fetchAllAdminAuditLogs, type AdminAuditLogRow } from '../lib/adminDashboard'
import { formatRelativeTime } from '../lib/labels'

const PAGE_SIZE = 30

export function AdminAuditLogsPage() {
  const { user } = useAuth()
  const [adminCheck, setAdminCheck] = useState<boolean | null>(null)
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('')

  const load = useCallback(async (p: number) => {
    setLoading(true)
    const { rows, total: count } = await fetchAllAdminAuditLogs(p, PAGE_SIZE)
    setLogs(rows)
    setTotal(count)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void (async () => {
      const isAdmin = await isAlertAdmin()
      setAdminCheck(isAdmin)
      if (isAdmin) {
        await load(page)
      } else {
        setLoading(false)
      }
    })()
  }, [user, page, load])

  const filtered = entityFilter
    ? logs.filter((l) => l.entity_type.toLowerCase().includes(entityFilter.toLowerCase()))
    : logs

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (!user || adminCheck === false) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <AlertCircle size={28} className="mx-auto text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">
              {user ? 'Admin access required.' : 'Sign in to view audit logs.'}
            </p>
            {!user && <Link to="/auth" className="btn-primary">Sign In</Link>}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {loading ? (
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading audit logs…</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-ocean-600">{total} total entries</p>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-ocean-400" />
                <input
                  type="text"
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  placeholder="Filter by type…"
                  className="input-field max-w-[140px] py-1 text-xs"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="card text-center">
                <History size={28} className="mx-auto text-ocean-300" />
                <p className="mt-2 text-sm text-ocean-600">No audit log entries.</p>
              </div>
            ) : (
              <div className="card divide-y divide-ocean-50">
                {filtered.map((log) => (
                  <div key={log.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-ocean-900">{log.action}</p>
                        <p className="text-[10px] text-ocean-500 capitalize">
                          {log.entity_type.replace(/_/g, ' ')}
                          {log.entity_id && ` • ${log.entity_id.slice(0, 8)}…`}
                        </p>
                        {log.summary && (
                          <p className="mt-1 text-[10px] text-ocean-600">{log.summary}</p>
                        )}
                      </div>
                      <p className="text-[10px] text-ocean-400">{formatRelativeTime(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="grid h-8 w-8 place-items-center rounded-full bg-ocean-50 text-ocean-700 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-ocean-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="grid h-8 w-8 place-items-center rounded-full bg-ocean-50 text-ocean-700 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-900 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-800 hover:bg-ocean-700">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <History size={18} />
          Admin Audit Logs
        </h1>
      </div>
    </header>
  )
}
