import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  Info,
  BookOpen,
  MapPin,
  Shield,
} from 'lucide-react'
import { fetchEmergencyGuide, GUIDE_CATEGORY_LABELS } from '../lib/emergencyInfo'
import { formatRelativeTime } from '../lib/labels'
import type { EmergencyGuideRow } from '../lib/emergencyInfo'

export function EmergencyGuideDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [guide, setGuide] = useState<EmergencyGuideRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      const g = await fetchEmergencyGuide(id)
      setGuide(g)
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-red-700 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/emergency" className="grid h-9 w-9 place-items-center rounded-full bg-red-600 hover:bg-red-500">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Safety Guide</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading guide…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!guide) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-30 bg-red-700 text-white shadow-card">
          <div className="flex items-center gap-3 px-4 py-4">
            <Link to="/emergency" className="grid h-9 w-9 place-items-center rounded-full bg-red-600 hover:bg-red-500">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">Safety Guide</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          <div className="card flex flex-col items-center gap-2 text-center">
            <AlertTriangle size={24} className="text-ocean-400" />
            <p className="text-sm font-bold text-ocean-900">Guide not found</p>
            <Link to="/emergency" className="btn-primary text-xs mt-2">Back to Emergency & Safety</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-red-700 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/emergency" className="grid h-9 w-9 place-items-center rounded-full bg-red-600 hover:bg-red-500">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-red-500">
            <BookOpen size={18} />
          </span>
          <h1 className="text-lg font-bold truncate">{guide.title}</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Critical reminder */}
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2">
            <Shield size={16} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-xs font-semibold text-red-800">
              For any emergency, contact the appropriate verified emergency hotline directly.
              This guide is informational only and does not replace professional emergency assistance.
            </p>
          </div>
        </div>

        {/* Guide content */}
        <section className="card space-y-3">
          <div>
            <p className="text-xs font-semibold text-ocean-600">
              {GUIDE_CATEGORY_LABELS[guide.category] ?? guide.category}
            </p>
            <p className="font-bold text-ocean-900">{guide.title}</p>
          </div>

          {guide.municipality && (
            <p className="flex items-center gap-1 text-xs text-ocean-500">
              <MapPin size={12} /> {guide.municipality}
            </p>
          )}

          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-sm text-ocean-800 leading-relaxed">{guide.content}</p>
          </div>
        </section>

        {/* Source & verification */}
        <section className="card space-y-1 text-xs text-ocean-500">
          <p className="font-semibold text-ocean-700">Source & Verification</p>
          {guide.source_name && <p>Source: {guide.source_name}</p>}
          {guide.source_url && (
            <a href={guide.source_url} target="_blank" rel="noopener noreferrer" className="text-ocean-500 hover:text-ocean-700 underline">
              {guide.source_url}
            </a>
          )}
          <p>Status: {guide.verification_status}</p>
          {guide.reviewed_at && <p>Reviewed: {formatRelativeTime(guide.reviewed_at)}</p>}
          <p>Published: {formatRelativeTime(guide.created_at)}</p>
        </section>

        {/* Link back to contacts */}
        <Link to="/emergency" className="card flex items-center gap-3 hover:shadow-cardHover transition">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-700">
            <AlertTriangle size={20} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-ocean-900">Emergency Hotlines</p>
            <p className="text-xs text-ocean-600">View verified emergency contacts</p>
          </div>
          <ArrowLeft size={18} className="rotate-180 text-ocean-400" />
        </Link>

        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            This safety guide is sourced from verified authoritative sources and reviewed by
            authorized MoryonGo administrators. It is for informational purposes only and does
            not constitute professional emergency advice.
          </p>
        </section>
      </main>
    </div>
  )
}
