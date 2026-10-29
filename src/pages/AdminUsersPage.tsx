import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  Users,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isAlertAdmin } from '../lib/transportAlerts'
import { searchUsers, type AdminUserRow } from '../lib/adminDashboard'
import { formatRelativeTime } from '../lib/labels'

const PAGE_SIZE = 20

export function AdminUsersPage() {
  const { user } = useAuth()
  const [adminCheck, setAdminCheck] = useState<boolean | null>(null)
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true)
    const { rows: data, total: count } = await searchUsers(q, p, PAGE_SIZE)
    setRows(data)
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
        await load(query, page)
      } else {
        setLoading(false)
      }
    })()
  }, [user, query, page, load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (!user || adminCheck === false) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card text-center space-y-3">
            <AlertCircle size={28} className="mx-auto text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">
              {user ? 'Admin access required.' : 'Sign in to manage users.'}
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
        {/* Search bar */}
        <div className="card flex items-center gap-2">
          <Search size={16} className="text-ocean-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name, email, or username…"
            className="input-field border-0 shadow-none focus:ring-0 py-1 text-sm"
          />
        </div>

        {loading ? (
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading users…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="card text-center">
            <Users size={28} className="mx-auto text-ocean-300" />
            <p className="mt-2 text-sm text-ocean-600">No users found.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-ocean-600">{total} total users</p>
            <div className="card divide-y divide-ocean-50">
              {rows.map((u) => (
                <div key={u.id} className="flex items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ocean-900">
                      {u.name || u.username || 'Unnamed'}
                    </p>
                    <p className="text-xs text-ocean-600 truncate">{u.email || 'No email'}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {u.home_municipality && (
                        <span className="rounded-full bg-ocean-50 px-2 py-0.5 text-[10px] text-ocean-600">
                          {u.home_municipality}
                        </span>
                      )}
                      <span className="rounded-full bg-ocean-50 px-2 py-0.5 text-[10px] text-ocean-600">
                        {u.preferred_language === 'filipino' ? 'Filipino' : 'English'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-ocean-400">{formatRelativeTime(u.created_at)}</p>
                </div>
              ))}
            </div>

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
          <Users size={18} />
          User Accounts
        </h1>
      </div>
    </header>
  )
}
