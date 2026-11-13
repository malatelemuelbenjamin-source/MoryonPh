/// <reference types="vite/client" />

declare const CESIUM_BASE_URL: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_CESIUM_ION_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
