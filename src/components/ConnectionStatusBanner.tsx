import { useState, useEffect } from 'react'
import {
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react'
import { useOffline, type ConnectionStatus } from '../lib/offline'

const STATUS_CONFIG: Record<ConnectionStatus, { icon: typeof Wifi; color: string; bg: string; label: string }> = {
  online: { icon: Wifi, color: 'text-leaf-700', bg: 'bg-leaf-50', label: 'Online' },
  slow: { icon: AlertTriangle, color: 'text-terra-700', bg: 'bg-terra-50', label: 'Slow connection' },
  reconnecting: { icon: Loader2, color: 'text-ocean-700', bg: 'bg-ocean-50', label: 'Reconnecting…' },
  offline: { icon: WifiOff, color: 'text-red-700', bg: 'bg-red-50', label: 'Offline — using cached data' },
}

export function ConnectionStatusBanner() {
  const { status } = useOffline()
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed when status changes to a different non-online state
  useEffect(() => {
    if (status !== 'online') setDismissed(false)
  }, [status])

  if (status === 'online' || dismissed) return null

  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${config.bg} ${config.color} px-4 py-2 shadow-card`}>
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <Icon size={14} className={status === 'reconnecting' ? 'animate-spin' : ''} />
        <span className="flex-1 text-xs font-semibold">{config.label}</span>
        {status !== 'offline' && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
