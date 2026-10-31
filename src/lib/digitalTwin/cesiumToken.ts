import { DIGITAL_TWIN_CONFIG } from './config'

const STORAGE_KEY = 'moryongo.cesiumIonToken'
const TOKEN_PATTERN = /^[\w-]+\.[\w-]+\.[\w-]+$/

export type CesiumTokenSource = 'browser' | 'project' | 'none'

export function isValidCesiumToken(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

export function getStoredCesiumToken(): string | null {
  return window.localStorage.getItem(STORAGE_KEY)?.trim() || null
}

export function saveCesiumToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token)
}

export function clearCesiumToken() {
  window.localStorage.removeItem(STORAGE_KEY)
}

export function resolveCesiumToken(): string | null {
  return getStoredCesiumToken() ?? DIGITAL_TWIN_CONFIG.cesiumIonToken
}

export function describeCesiumTokenSource(): CesiumTokenSource {
  if (getStoredCesiumToken()) return 'browser'
  if (DIGITAL_TWIN_CONFIG.cesiumIonToken) return 'project'
  return 'none'
}
