let loadPromise: Promise<void> | null = null

export function getGoogleMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0
}

export function loadGoogleMapsApi(): Promise<void> {
  if (loadPromise) return loadPromise
  const key = getGoogleMapsApiKey()

  if (!key) {
    return Promise.reject(new Error('Missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY in your environment.'))
  }

  if (typeof google !== 'undefined' && google.maps) {
    loadPromise = Promise.resolve()
    return loadPromise
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__gmaps_init_cb__'
    ;(window as unknown as Record<string, unknown>)[callbackName] = () => resolve()

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker&callback=${callbackName}`
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Failed to load Google Maps script.'))
    document.head.appendChild(script)
  })

  return loadPromise
}
