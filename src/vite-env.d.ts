/// <reference types="vite/client" />

declare const CESIUM_BASE_URL: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_CESIUM_ION_TOKEN?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(element: Element, options: MapOptions)
      panTo(latLng: LatLngLiteral): void
      setCenter(latLng: LatLngLiteral): void
    }
    class Marker {
      constructor(options: MarkerOptions)
      setMap(map: Map | null): void
      addListener(event: string, handler: () => void): void
    }
    interface MapOptions {
      center?: LatLngLiteral
      zoom?: number
      mapTypeControl?: boolean
      streetViewControl?: boolean
      fullscreenControl?: boolean
      styles?: MapTypeStyle[]
    }
    interface MarkerOptions {
      position: LatLngLiteral
      map?: Map
      title?: string
      label?: MarkerLabel
      icon?: Symbol
    }
    interface MarkerLabel {
      text: string
      fontSize?: string
      fontWeight?: string
      color?: string
    }
    interface Symbol {
      path: number
      scale?: number
      fillColor?: string
      fillOpacity?: number
      strokeColor?: string
      strokeWeight?: number
    }
    interface LatLngLiteral {
      lat: number
      lng: number
    }
    interface MapTypeStyle {
      featureType?: string
      stylers?: { visibility?: string }[]
    }
    const SymbolPath: { CIRCLE: number }
  }
}
