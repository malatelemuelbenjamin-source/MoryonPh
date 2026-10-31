import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { importRoadNetwork } from '../lib/roadNetwork'

interface RoadImportPanelProps {
  onImported: () => void
}

export function RoadImportPanel({ onImported }: RoadImportPanelProps) {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const handleImport = async () => {
    setRunning(true)
    setMessage(null)
    try {
      const result = await importRoadNetwork()
      setMessage({
        tone: 'success',
        text: `Imported ${result.roadCount.toLocaleString()} roads as a new version. Review it below before publishing; the public map does not change until you publish.`,
      })
      onImported()
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'The road import failed. Try again later.' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="text-base font-bold text-ocean-900">Import road network</h2>
        <p className="text-sm text-ocean-700">
          Fetches road lines for Marinduque from OpenStreetMap. The import can take up to two minutes. If it fails, existing published roads are kept.
        </p>
      </div>
      <div>
        <button type="button" onClick={() => void handleImport()} disabled={running} className="btn-primary inline-flex items-center gap-2">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {running ? 'Importing roads…' : 'Fetch road network'}
        </button>
      </div>
      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${message.tone === 'error' ? 'text-red-700' : 'text-leaf-700'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}
