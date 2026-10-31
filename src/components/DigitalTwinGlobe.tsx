import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Maximize, Minimize, Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react'
import {
  createGlobeViewer,
  flyToMarinduque,
  hasWebGL,
  loadCesium,
  setSceneMode,
  zoomCamera,
  type Cesium,
  type CesiumViewer,
  type SceneMode,
} from '../lib/digitalTwin/globeEngine'

type GlobeStatus = 'loading' | 'ready' | 'error'

const CONTROL_BUTTON =
  'grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ocean-800 shadow-card transition hover:bg-white active:scale-95 disabled:opacity-50'

export function DigitalTwinGlobe() {
  const [webglSupported] = useState(hasWebGL)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CesiumViewer | null>(null)
  const cesiumRef = useRef<Cesium | null>(null)
  const [status, setStatus] = useState<GlobeStatus>('loading')
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [sceneMode, setSceneModeState] = useState<SceneMode>('3d')
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!webglSupported) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let viewer: CesiumViewer | null = null
    setStatus('loading')
    setNotice(null)

    void (async () => {
      try {
        const Cesium = await loadCesium()
        if (cancelled) return
        const result = await createGlobeViewer(container, Cesium)
        if (cancelled) {
          result.viewer.destroy()
          return
        }
        viewer = result.viewer
        viewerRef.current = viewer
        cesiumRef.current = Cesium
        setNotice(result.notice)
        flyToMarinduque(viewer, Cesium, 0)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      viewer?.destroy()
      viewerRef.current = null
      cesiumRef.current = null
    }
  }, [attempt, webglSupported])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current)
      window.dispatchEvent(new Event('resize'))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const withViewer = (action: (viewer: CesiumViewer, Cesium: Cesium) => void) => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (viewer && Cesium) action(viewer, Cesium)
  }

  const handleSceneMode = () => {
    const next: SceneMode = sceneMode === '3d' ? '2d' : '3d'
    setSceneModeState(next)
    withViewer((viewer) => setSceneMode(viewer, next))
  }

  const handleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await wrapperRef.current?.requestFullscreen()
    } catch {
      setNotice('Full-screen is not available on this device.')
    }
  }

  if (!webglSupported) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-xl bg-ocean-50 p-4 text-center">
        <AlertCircle size={28} className="text-terra-600" />
        <p className="text-sm font-semibold text-ocean-900">3D view is not supported on this device.</p>
        <p className="text-xs text-ocean-600">Use the list or 2D map instead.</p>
      </div>
    )
  }

  const isReady = status === 'ready'

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden bg-ocean-900 ${isFullscreen ? 'h-full w-full' : 'h-80 rounded-xl'}`}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ocean-900 text-white">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-sm font-semibold">Loading 3D map…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ocean-900 p-4 text-center text-white">
          <AlertCircle size={28} className="text-terra-300" />
          <p className="text-sm font-semibold">The 3D map could not start. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ocean-900"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {notice && isReady && (
        <p className="absolute left-3 top-3 right-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-ocean-800 shadow-card">
          {notice}
        </p>
      )}

      {isReady && (
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
          <button type="button" aria-label="Zoom in" className={CONTROL_BUTTON} onClick={() => withViewer((v) => zoomCamera(v, 'in'))}>
            <Plus size={18} />
          </button>
          <button type="button" aria-label="Zoom out" className={CONTROL_BUTTON} onClick={() => withViewer((v) => zoomCamera(v, 'out'))}>
            <Minus size={18} />
          </button>
          <button type="button" aria-label="Reset view to Marinduque" className={CONTROL_BUTTON} onClick={() => withViewer((v, c) => flyToMarinduque(v, c))}>
            <RotateCcw size={18} />
          </button>
          <button type="button" aria-label={sceneMode === '3d' ? 'Switch to 2D' : 'Switch to 3D'} className={`${CONTROL_BUTTON} text-xs font-bold`} onClick={handleSceneMode}>
            {sceneMode === '3d' ? '2D' : '3D'}
          </button>
          <button type="button" aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} className={CONTROL_BUTTON} onClick={() => void handleFullscreen()}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      )}
    </div>
  )
}
