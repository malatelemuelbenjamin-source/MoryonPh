export const DIGITAL_TWIN_CONFIG = {
  cesiumBaseUrl: CESIUM_BASE_URL,
  cesiumIonToken: import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() || null,
  // Approximate viewing area for the initial camera only. It is not survey data.
  marinduqueViewBounds: {
    west: 121.75,
    south: 13.15,
    east: 122.1,
    north: 13.7,
  },
  initialCameraHeightMeters: 60000,
} as const

export type DigitalTwinConfig = typeof DIGITAL_TWIN_CONFIG
