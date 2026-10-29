import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PlaceholderProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderProps) {
  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link
            to="/"
            aria-label="Back to home"
            className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
      </header>
      <main className="flex-1 px-4 py-8">
        <div className="card text-center">
          <p className="text-base font-semibold text-ocean-900">
            This MoryonGo feature will be available soon.
          </p>
          {description && (
            <p className="mt-2 text-sm text-ocean-700">{description}</p>
          )}
          <Link to="/" className="btn-primary mt-4 inline-flex">
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
