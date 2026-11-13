import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Lock } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'

const MIN_PASSWORD_LENGTH = 6

export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    const res = await updatePassword(password)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            to="/auth"
            aria-label="Back to sign in"
            className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">Choose New Password</h1>
        </div>
      </header>
      <main className="flex-1 px-4 py-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo size={56} />
          <h2 className="text-xl font-extrabold text-ocean-900">MoryonGo</h2>
        </div>

        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="animate-spin text-ocean-600" size={32} />
          </div>
        ) : !session ? (
          <div className="card space-y-4 text-center">
            <p className="text-sm text-ocean-800">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <button type="button" onClick={() => navigate('/auth')} className="btn-primary w-full">
              Back to Sign In
            </button>
          </div>
        ) : done ? (
          <div className="card space-y-4 text-center">
            <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm font-semibold text-leaf-700">
              Your password has been updated. You are now signed in.
            </p>
            <button type="button" onClick={() => navigate('/')} className="btn-primary w-full">
              Continue to MoryonGo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ocean-800">New password</span>
              <span className="flex items-center gap-2 rounded-xl border border-ocean-100 bg-white px-3 py-2.5 focus-within:border-ocean-400">
                <Lock size={18} className="text-ocean-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full bg-transparent text-base text-ocean-900 focus:outline-none"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ocean-800">Confirm new password</span>
              <span className="flex items-center gap-2 rounded-xl border border-ocean-100 bg-white px-3 py-2.5 focus-within:border-ocean-400">
                <Lock size={18} className="text-ocean-500" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full bg-transparent text-base text-ocean-900 focus:outline-none"
                />
              </span>
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
