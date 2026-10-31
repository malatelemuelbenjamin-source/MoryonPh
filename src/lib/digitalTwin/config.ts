// Marinduque center is the average of the six municipality coordinates in src/lib/location.tsx.
export const DIGITAL_TWIN_CONFIG = {
  cesiumIonToken: import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() || null,
  marinduqueCenter: { latitude: 13.4111, longitude: 121.9 },
  marinduqueViewBounds: { west: 121.75, south: 13.15, east: 122.1, north: 13.7 },
  initialCameraHeightMeters: 60000,
} as const
