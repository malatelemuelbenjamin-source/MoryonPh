import { Crosshair, MapPin, Navigation2 } from 'lucide-react'
import { useLocation } from '../lib/location'

function accuracyLabel(acc: number | null): string {
  if (acc == null) return 'Unavailable'
  if (acc <= 50) return 'Accurate'
  if (acc <= 200) return 'Approximate'
  return 'Approximate'
}

export function CurrentLocationCard() {
  const { status, municipality, barangay, area, accuracy, requestPermission } = useLocation()

  const granted = status === 'granted'
  const canUse = granted && municipality != null

  const locationText = municipality
    ? `${municipality}, Marinduque`
    : 'Marinduque, Philippines'

  const barangayText = barangay
    ? `Barangay ${barangay}`
    : area
      ? area
      : 'Barangay: detecting…'

  return (
    <section>
      <h2 className="section-title mb-3">Your Location</h2>
      <div className="card">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-11 w-11 place-items-center rounded-full ${
              granted ? 'bg-leaf-400/30 text-leaf-700' : 'bg-sand-200 text-ocean-700'
            }`}
          >
            <Crosshair size={22} />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-terra-500" />
              <span className="text-lg font-bold text-ocean-900">{locationText}</span>
            </div>
            <div className="mt-0.5 text-sm text-ocean-700">
              {barangayText}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span className="font-semibold text-ocean-800">GPS:</span>
              <span
                className={`pill ${
                  !granted
                    ? 'bg-red-100 text-red-700'
                    : accuracy != null && accuracy <= 50
                      ? 'bg-leaf-500/20 text-leaf-700'
                      : 'bg-sand-200 text-terra-700'
                }`}
              >
                {granted ? accuracyLabel(accuracy) : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {canUse ? (
            <button type="button" className="btn-primary w-full">
              <Navigation2 size={18} />
              Use My Location
            </button>
          ) : (
            <button
              type="button"
              onClick={requestPermission}
              className="btn-secondary w-full"
            >
              <Crosshair size={18} />
              Enable Location
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
