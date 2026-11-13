import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, FileText } from 'lucide-react'
import { fetchPageBySlug, type ContentPage } from '../lib/superAdmin'

export function CmsPageView() {
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState<ContentPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    void (async () => {
      if (!slug) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const result = await fetchPageBySlug(slug)
      if (result) setPage(result)
      else setNotFound(true)
      setLoading(false)
    })()
  }, [slug])

  if (loading) {
    return (
      <div className="app-shell">
        <main className="flex-1 grid place-items-center px-4 py-12">
          <Loader2 className="animate-spin text-ocean-600" size={28} />
        </main>
      </div>
    )
  }

  if (notFound || !page) {
    return (
      <div className="app-shell">
        <main className="flex-1 grid place-items-center px-4 py-12 text-center">
          <div className="card p-6">
            <FileText className="mx-auto text-ocean-400" size={32} />
            <h1 className="mt-3 text-xl font-bold text-ocean-900">Page not found</h1>
            <p className="mt-1 text-sm text-ocean-600">This page may have been unpublished or removed.</p>
            <Link to="/" className="btn-secondary mt-4">Back to Home</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="flex-1 px-4 py-8">
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-ocean-900">{page.title}</h1>
          {page.excerpt && <p className="mt-2 text-sm text-ocean-600">{page.excerpt}</p>}
          {page.content && (
            <div className="prose prose-ocean mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-ocean-800">
              {page.content}
            </div>
          )}
        </article>
      </main>
    </div>
  )
}
