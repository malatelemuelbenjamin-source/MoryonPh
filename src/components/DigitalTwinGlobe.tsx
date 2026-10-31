import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, KeyRound, Loader2, Maximize, Minimize, Minus, Plus, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react'
import {
  applyMapSettings,
  createGlobeViewer,
  flyToMarinduque,
  hasWebGL,
  loadCesium,
  setSceneMode,
  zoomCamera,
  type AppliedMapState,
  type Cesium,
  type CesiumViewer,
  type SceneMode,
} from '../lib/digitalTwin/globeEngine'
import { loadGlobeData, type GlobeData } from '../lib/digitalTwin/globeData'
import { renderGlobeLayers, setIslandOutlineVisible } from '../lib/digitalTwin/globeLayers'
import { FALLBACK_IMAGERY_ID } from '../lib/digitalTwin/mapProviders'
import {
  defaultMapSettings,
  loadMapSettings,
  resetMapSettings,
  saveMapSettings,
  type MapSettings,
} from '../lib/digitalTwin/mapSettings'
import {
  clearCesiumToken,
  describeCesiumTokenSource,
  getStoredCesiumToken,
  isValidCesiumToken,
  resolveCesiumToken,
  saveCesiumToken,
} from '../lib/digitalTwin/cesiumToken'
import { MapSettingsPanel } from './MapSettingsPanel'

type GlobeStatus = 'loading' | 'ready' | 'error'

const CONTROL_BUTTON =
  'grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ocean-800 shadow-card transition hover:bg-white active:scale-95 disabled:opacity-50'

const NO_TOKEN_NOTICE = 'Showing a basic world map. Add a Cesium token with the key button for aerial imagery and terrain.'

const TOKEN_SOURCE_LABELS = {
  browser: 'Using the token saved in this browser.',
  project: 'Using the token set for this project.',
  none: 'No token set. The basic world map is shown.',
} as const

function describeGlobeLayers(data: GlobeData): string {
  const outlines = data.boundaries
    ? `${data.boundaries.length} municipality outlines`
    : 'Municipality outlines could not be loaded'
  const island = data.islandOutline
    ? `Island outline ${data.islandOutline.verificationStatus === 'verified' ? '(verified)' : '(unverified dataset)'}`
    : 'No island outline published yet'
  const routes = data.routes.filter((route) => route.path.length >= 2).length
  const routeText = routes > 0 ? `${routes} commuter routes` : 'No commuter routes are published yet'
  return `${outlines} · ${island} · ${routeText}`
}

export function DigitalTwinGlobe() {
  const [webglSupported] = useState(hasWebGL)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CesiumViewer | null>(null)
  const cesiumRef = useRef<Cesium | null>(null)
  const applyQueueRef = useRef<Promise<void>>(Promise.resolve())
  const [status, setStatus] = useState<GlobeStatus>('loading')
  const [attempt, setAttempt] = useState(0)
  const [sceneMode, setSceneModeState] = useState<SceneMode>('3d')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [storedToken, setStoredToken] = useState<string | null>(getStoredCesiumToken)
  const [mapSettings, setMapSettings] = useState<MapSettings>(() => loadMapSettings(resolveCesiumToken() !== null))
  const [appliedMap, setAppliedMap] = useState<AppliedMapState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false)
  const [tokenDraft, setTokenDraft] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [layerSummary, setLayerSummary] = useState<string | null>(null)
  const [layersReady, setLayersReady] = useState(false)
  const [tilesLoading, setTilesLoading] = useState(false)
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!webglSupported) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let viewer: CesiumViewer | null = null
    setStatus('loading')
    setLayerSummary(null)

    void (async () => {
      try {
        const Cesium = await loadCesium()
        if (cancelled) return
        viewer = createGlobeViewer(container, Cesium)
        viewerRef.current = viewer
        cesiumRef.current = Cesium
        viewer.scene.globe.tileLoadProgressEvent.addEventListener((pendingTiles: number) => {
          setTilesLoading(pendingTiles > 0)
        })
        flyToMarinduque(viewer, Cesium, 0)
        setStatus('ready')
      } catch {
        viewer?.destroy()
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      viewer?.destroy()
      viewerRef.current = null
      cesiumRef.current = null
      setTilesLoading(false)
    }
  }, [attempt, webglSupported])

  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    setLayersReady(false)

    void (async () => {
      try {
        const Cesium = await loadCesium()
        const data = await loadGlobeData()
        const viewer = viewerRef.current
        if (cancelled || !viewer || !cesiumRef.current) return
        renderGlobeLayers(viewer, Cesium, data)
        setLayerSummary(describeGlobeLayers(data))
        setLayersReady(true)
      } catch {
        if (!cancelled) setLayerSummary('Commuter layers could not be loaded.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!layersReady || !viewer) return
    setIslandOutlineVisible(viewer, mapSettings.showIslandOutline)
  }, [layersReady, mapSettings.showIslandOutline])

  useEffect(() => {
    if (status !== 'ready') return

    applyQueueRef.current = applyQueueRef.current.then(async () => {
      const viewer = viewerRef.current
      const Cesium = cesiumRef.current
      if (!viewer || !Cesium || viewer.isDestroyed()) return
      try {
        const applied = await applyMapSettings(viewer, Cesium, mapSettings, resolveCesiumToken(), (message) => {
          setAppliedMap((previous) =>
            previous && {
              ...previous,
              imageryId: FALLBACK_IMAGERY_ID,
              imageryIsFallback: true,
              messages: [...previous.messages, message],
            },
          )
        })
        if (!viewer.isDestroyed()) setAppliedMap(applied)
      } catch {
        if (!viewer.isDestroyed()) setStatus('error')
      }
    })
  }, [status, mapSettings])

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
    setFullscreenNotice(null)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await wrapperRef.current?.requestFullscreen()
    } catch {
      setFullscreenNotice('Full-screen is not available on this device.')
    }
  }

  const handleSettingsChange = (next: MapSettings) => {
    saveMapSettings(next)
    setMapSettings(next)
  }

  const handleSettingsReset = () => {
    resetMapSettings()
    setMapSettings(defaultMapSettings(resolveCesiumToken() !== null))
  }

  const openTokenPanel = () => {
    setSettingsOpen(false)
    setTokenDraft(storedToken ?? '')
    setTokenError(null)
    setTokenPanelOpen(true)
  }

  const openSettingsPanel = () => {
    setTokenPanelOpen(false)
    setSettingsOpen(true)
  }

  const handleTokenSave = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = tokenDraft.trim()
    if (!isValidCesiumToken(trimmed)) {
      setTokenError('This does not look like a Cesium token. Copy the full token from your Cesium ion account.')
      return
    }
    saveCesiumToken(trimmed)
    setStoredToken(trimmed)
    setMapSettings(loadMapSettings(true))
    setTokenPanelOpen(false)
    setAttempt((n) => n + 1)
  }

  const handleTokenRemove = () => {
    clearCesiumToken()
    setStoredToken(null)
    setMapSettings(loadMapSettings(resolveCesiumToken() !== null))
    setTokenPanelOpen(false)
    setAttempt((n) => n + 1)
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
  const hasToken = resolveCesiumToken() !== null
  const notices = [
    ...(hasToken ? [] : [NO_TOKEN_NOTICE]),
    ...(appliedMap?.messages ?? []),
  ]

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
          <p className="text-sm font-semibold">The 3D map could not start. Check your connection, or check the Cesium token.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ocean-900"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {isReady && tilesLoading && (
        <p className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs text-ocean-800 shadow-card">
          Loading map detail…
        </p>
      )}

      {layerSummary && isReady && (
        <p className="absolute bottom-3 left-3 z-10 max-w-[60%] rounded-lg bg-white/95 px-3 py-2 text-xs text-ocean-800 shadow-card">
          {layerSummary}
        </p>
      )}

      {(notices.length > 0 || fullscreenNotice) && isReady && (
        <p className="absolute left-3 right-28 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-ocean-800 shadow-card">
          {[...notices, fullscreenNotice].filter(Boolean).join(' ')}
        </p>
      )}

      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          aria-label="Map settings"
          className={CONTROL_BUTTON}
          onClick={openSettingsPanel}
        >
          <SlidersHorizontal size={18} />
        </button>
        <button
          type="button"
          aria-label="Set Cesium token"
          className={CONTROL_BUTTON}
          onClick={openTokenPanel}
        >
          <KeyRound size={18} />
        </button>
      </div>

      {settingsOpen && isReady && (
        <MapSettingsPanel
          settings={mapSettings}
          hasToken={hasToken}
          applied={appliedMap}
          onChange={handleSettingsChange}
          onReset={handleSettingsReset}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {tokenPanelOpen && (
        <form
          onSubmit={handleTokenSave}
          className="absolute inset-x-3 top-3 z-20 space-y-2 rounded-xl bg-white p-3 shadow-cardHover"
        >
          <p className="text-sm font-bold text-ocean-900">Cesium access token</p>
          <p className="text-xs text-ocean-600">{TOKEN_SOURCE_LABELS[describeCesiumTokenSource()]}</p>
          <input
            type="text"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder="Paste your Cesium token"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-ocean-200 px-3 py-2 text-xs text-ocean-900 focus:outline-none focus:ring-2 focus:ring-ocean-300"
          />
          {tokenError && <p className="text-xs text-red-700">{tokenError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary text-xs">Save and reload</button>
            {storedToken && (
              <button type="button" onClick={handleTokenRemove} className="btn-secondary text-xs">Remove</button>
            )}
            <button type="button" onClick={() => setTokenPanelOpen(false)} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </form>
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
