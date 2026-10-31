import { checkCrs } from './geoJsonValidation'

export type UploadFormat = 'geojson' | 'kml' | 'csv'

export interface GeoJsonGeometry {
  type: string
  coordinates?: unknown
  geometries?: GeoJsonGeometry[]
}

export interface RawFeature {
  geometry: GeoJsonGeometry | null
  properties: Record<string, string>
}

export interface ParsedDataset {
  format: UploadFormat
  features: RawFeature[]
  fields: string[]
  crsName: string | null
}

export type ParseResult = { ok: true; dataset: ParsedDataset } | { ok: false; errors: string[] }

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_FEATURES = 10000

const UNSUPPORTED_EXTENSIONS = ['kmz', 'zip', 'shp', 'shx', 'dbf', 'prj']
const EXTENSION_FORMATS: Record<string, UploadFormat> = { geojson: 'geojson', json: 'geojson', kml: 'kml', csv: 'csv' }
const LAT_NAMES = ['lat', 'latitude', 'y']
const LON_NAMES = ['lon', 'lng', 'long', 'longitude', 'x']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringifyProperties(properties: unknown): Record<string, string> {
  if (!isRecord(properties)) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) result[key] = ''
    else if (typeof value === 'object') result[key] = JSON.stringify(value)
    else result[key] = String(value)
  }
  return result
}

function fieldsOf(features: RawFeature[]): string[] {
  const names = new Set<string>()
  for (const feature of features) {
    for (const key of Object.keys(feature.properties)) names.add(key)
  }
  return [...names]
}

function parseGeoJsonText(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['The file is not valid JSON, so it cannot be read as GeoJSON.'] }
  }
  if (!isRecord(parsed)) return { ok: false, errors: ['The file must contain a GeoJSON object.'] }

  const crsErrors: string[] = []
  checkCrs(parsed.crs, crsErrors)
  if (crsErrors.length > 0) return { ok: false, errors: crsErrors }

  const crsProperties = isRecord(parsed.crs) && isRecord(parsed.crs.properties) ? parsed.crs.properties : null
  const crsName = crsProperties && typeof crsProperties.name === 'string' ? crsProperties.name : null

  const toFeature = (value: unknown): RawFeature => {
    if (!isRecord(value)) return { geometry: null, properties: {} }
    const geometry = isRecord(value.geometry) && typeof value.geometry.type === 'string'
      ? (value.geometry as unknown as GeoJsonGeometry)
      : null
    return { geometry, properties: stringifyProperties(value.properties) }
  }

  let features: RawFeature[]
  if (parsed.type === 'FeatureCollection') {
    features = Array.isArray(parsed.features) ? parsed.features.map(toFeature) : []
  } else if (parsed.type === 'Feature') {
    features = [toFeature(parsed)]
  } else if (typeof parsed.type === 'string') {
    features = [{ geometry: parsed as unknown as GeoJsonGeometry, properties: {} }]
  } else {
    return { ok: false, errors: ['The GeoJSON object has no recognizable type.'] }
  }

  return { ok: true, dataset: { format: 'geojson', features, fields: fieldsOf(features), crsName } }
}

function parseKmlCoordinates(text: string): number[][] {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => token.split(',').slice(0, 2).map(Number))
}

function kmlGeometry(element: Element): GeoJsonGeometry | null {
  const coordinateBlocks = Array.from(element.getElementsByTagName('coordinates')).map((node) =>
    parseKmlCoordinates(node.textContent ?? ''),
  )
  switch (element.localName) {
    case 'Point':
      return { type: 'Point', coordinates: coordinateBlocks[0]?.[0] ?? [] }
    case 'LineString':
      return { type: 'LineString', coordinates: coordinateBlocks[0] ?? [] }
    case 'Polygon':
      return { type: 'Polygon', coordinates: coordinateBlocks }
    case 'MultiGeometry': {
      const children = Array.from(element.children)
        .map(kmlGeometry)
        .filter((child): child is GeoJsonGeometry => child !== null)
      if (children.length === 0) return null
      if (children.every((child) => child.type === 'Polygon')) {
        return { type: 'MultiPolygon', coordinates: children.map((child) => child.coordinates) }
      }
      if (children.every((child) => child.type === 'Point')) {
        return { type: 'MultiPoint', coordinates: children.map((child) => child.coordinates) }
      }
      if (children.every((child) => child.type === 'LineString')) {
        return { type: 'MultiLineString', coordinates: children.map((child) => child.coordinates) }
      }
      return { type: 'GeometryCollection', geometries: children }
    }
    default:
      return null
  }
}

function directChildText(element: Element, name: string): string {
  const child = Array.from(element.children).find((node) => node.localName === name)
  return child?.textContent?.trim() ?? ''
}

function parseKmlText(text: string): ParseResult {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    return { ok: false, errors: ['KML files with DOCTYPE or ENTITY declarations are not accepted.'] }
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, errors: ['The KML file is not valid XML.'] }
  }

  const features: RawFeature[] = Array.from(doc.getElementsByTagName('Placemark')).map((placemark) => {
    const properties: Record<string, string> = {}
    const name = directChildText(placemark, 'name')
    if (name) properties.name = name
    const description = directChildText(placemark, 'description')
    if (description) properties.description = description
    for (const data of Array.from(placemark.getElementsByTagName('Data'))) {
      const key = data.getAttribute('name')
      if (key) properties[key] = directChildText(data, 'value')
    }
    for (const simple of Array.from(placemark.getElementsByTagName('SimpleData'))) {
      const key = simple.getAttribute('name')
      if (key) properties[key] = simple.textContent?.trim() ?? ''
    }
    const geometryElement = Array.from(placemark.children).find((node) =>
      ['Point', 'LineString', 'Polygon', 'MultiGeometry'].includes(node.localName),
    )
    return { geometry: geometryElement ? kmlGeometry(geometryElement) : null, properties }
  })

  return { ok: true, dataset: { format: 'kml', features, fields: fieldsOf(features), crsName: null } }
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function parseCsvText(text: string): ParseResult {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ''))
  if (rows.length < 2) {
    return { ok: false, errors: ['A CSV file needs a header row and at least one data row.'] }
  }
  const headers = rows[0].map((header) => header.trim())
  const lowered = headers.map((header) => header.toLowerCase())
  const latIndex = lowered.findIndex((header) => LAT_NAMES.includes(header))
  const lonIndex = lowered.findIndex((header) => LON_NAMES.includes(header))
  if (latIndex === -1 || lonIndex === -1) {
    return { ok: false, errors: ['The CSV file must include a latitude column and a longitude column (for example lat and lon).'] }
  }
  if (rows.length - 1 > MAX_FEATURES) {
    return { ok: false, errors: [`The CSV file has ${rows.length - 1} rows. The limit is ${MAX_FEATURES}.`] }
  }

  const toNumber = (cell: string | undefined) => (cell === undefined || cell.trim() === '' ? NaN : Number(cell))
  const features: RawFeature[] = rows.slice(1).map((row) => {
    const properties: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (header) properties[header] = row[index] ?? ''
    })
    return {
      geometry: { type: 'Point', coordinates: [toNumber(row[lonIndex]), toNumber(row[latIndex])] },
      properties,
    }
  })

  return {
    ok: true,
    dataset: { format: 'csv', features, fields: headers.filter((header) => header.length > 0), crsName: null },
  }
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

export async function parseGeographicFile(file: File): Promise<ParseResult> {
  if (file.size === 0) return { ok: false, errors: ['The file is empty.'] }
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, errors: ['The file is larger than 10 MB. Upload a simplified file.'] }

  const extension = extensionOf(file.name)
  if (UNSUPPORTED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      errors: ['Shapefile and KMZ/ZIP packages are not supported yet. Export the data as GeoJSON, KML or CSV and upload that file.'],
    }
  }
  const extensionFormat = EXTENSION_FORMATS[extension]
  if (!extensionFormat) {
    return { ok: false, errors: ['This file type is not supported. Use GeoJSON (.geojson, .json), KML (.kml) or CSV (.csv).'] }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return { ok: false, errors: ['This file is a compressed archive, not a plain text geographic file. Upload the extracted GeoJSON, KML or CSV file instead.'] }
  }
  if (bytes.subarray(0, 4096).includes(0)) {
    return { ok: false, errors: ['This file contains binary data and cannot be read as a geographic text file.'] }
  }

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return { ok: false, errors: ['The file is not valid UTF-8 text.'] }
  }

  const trimmed = text.trimStart()
  const contentFormat: UploadFormat = trimmed.startsWith('{')
    ? 'geojson'
    : /<kml[\s>]/i.test(trimmed.slice(0, 2000))
      ? 'kml'
      : 'csv'
  if (contentFormat !== extensionFormat) {
    return {
      ok: false,
      errors: [`The file contents look like ${contentFormat.toUpperCase()}, but the file name says ${extension.toUpperCase()}. Re-export the file in the matching format.`],
    }
  }

  if (contentFormat === 'geojson') return parseGeoJsonText(text)
  if (contentFormat === 'kml') return parseKmlText(text)
  return parseCsvText(text)
}
