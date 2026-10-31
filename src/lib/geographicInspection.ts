import {
  checkPosition,
  collectPolygons,
  type BoundaryBbox,
  type MultiPolygonCoordinates,
} from './geoJsonValidation'
import { MAX_FEATURES, type GeoJsonGeometry, type ParsedDataset, type UploadFormat } from './geographicFileParsers'
import { isBoundaryCategory, type UploadCategory } from './geographicCategories'

export interface FieldMapping {
  nameField: string | null
  codeField: string | null
}

export interface SampleRecord {
  index: number
  geometryType: string
  name: string
  code: string
}

export interface InspectionReport {
  format: UploadFormat
  featureCount: number
  countsByType: Record<string, number>
  fields: string[]
  bbox: BoundaryBbox | null
  crsNote: string
  criticalErrors: string[]
  warnings: string[]
  sampleRecords: SampleRecord[]
  boundaryGeometry: { type: 'MultiPolygon'; coordinates: MultiPolygonCoordinates } | null
}

export interface InspectionOptions {
  category: UploadCategory
  csvCrsConfirmed: boolean
  mapping: FieldMapping
}

const MAX_REPORTED_ERRORS = 12
const SAMPLE_LIMIT = 50
const SUPPORTED_TYPES = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']

export function suggestFieldMapping(fields: string[]): FieldMapping {
  const pick = (candidates: string[]) =>
    fields.find((field) => candidates.includes(field.trim().toLowerCase())) ?? null
  return {
    nameField: pick(['name', 'label', 'title', 'barangay', 'municipality', 'place']),
    codeField: pick(['psgc', 'psgc_code', 'official_code', 'pcode', 'code']),
  }
}

function positionsOf(coordinates: unknown): number[][] {
  if (!Array.isArray(coordinates)) return []
  if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [coordinates as number[]]
  }
  return coordinates.flatMap(positionsOf)
}

function checkLine(coordinates: unknown, where: string, errors: string[], minimum: number): boolean {
  if (!Array.isArray(coordinates) || coordinates.length < minimum) {
    errors.push(`${where} needs at least ${minimum} positions.`)
    return false
  }
  return coordinates.every((position, index) => checkPosition(position, `${where}, position ${index + 1}`, errors))
}

function checkGeometry(geometry: GeoJsonGeometry, where: string, errors: string[]): boolean {
  switch (geometry.type) {
    case 'Point':
      return checkPosition(geometry.coordinates, where, errors)
    case 'MultiPoint':
      return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0
        ? geometry.coordinates.every((position, index) => checkPosition(position, `${where}, point ${index + 1}`, errors))
        : (errors.push(`${where} has no points.`), false)
    case 'LineString':
      return checkLine(geometry.coordinates, where, errors, 2)
    case 'MultiLineString':
      return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0
        ? geometry.coordinates.every((line, index) => checkLine(line, `${where}, line ${index + 1}`, errors, 2))
        : (errors.push(`${where} has no lines.`), false)
    case 'Polygon':
    case 'MultiPolygon':
      return collectPolygons(geometry, where, errors).length > 0
    default:
      return false
  }
}

export function inspectDataset(dataset: ParsedDataset, options: InspectionOptions): InspectionReport {
  const { category, mapping } = options
  const isBoundary = isBoundaryCategory(category)
  const errors: string[] = []
  const warnings: string[] = []
  const countsByType: Record<string, number> = {}
  const polygons: number[][][][] = []
  const seenGeometries = new Set<string>()
  const positions: number[][] = []
  const sampleRecords: SampleRecord[] = []
  let duplicateCount = 0
  let missingName = 0

  if (dataset.features.length === 0) errors.push('The file contains no features.')
  if (dataset.features.length > MAX_FEATURES) {
    errors.push(`The file has ${dataset.features.length} features. The limit is ${MAX_FEATURES}.`)
  }
  if (dataset.format === 'csv' && !options.csvCrsConfirmed) {
    errors.push('Confirm that the coordinates are WGS 84 longitude and latitude before the CSV file can be checked.')
  }
  if (dataset.format === 'geojson' && !dataset.crsName) {
    warnings.push('The file names no coordinate system. Coordinates are read as WGS 84 longitude and latitude, as the GeoJSON standard specifies.')
  }

  dataset.features.forEach((feature, index) => {
    const where = `Feature ${index + 1}`
    const geometry = feature.geometry
    const name = mapping.nameField ? (feature.properties[mapping.nameField] ?? '') : ''
    const code = mapping.codeField ? (feature.properties[mapping.codeField] ?? '') : ''

    if (mapping.nameField && name.trim() === '') missingName++
    if (sampleRecords.length < SAMPLE_LIMIT) {
      sampleRecords.push({ index: index + 1, geometryType: geometry?.type ?? 'none', name, code })
    }

    if (!geometry) {
      errors.push(`${where} has no geometry.`)
      return
    }
    countsByType[geometry.type] = (countsByType[geometry.type] ?? 0) + 1

    if (!SUPPORTED_TYPES.includes(geometry.type)) {
      errors.push(`${where} is a ${geometry.type}, which is not supported. Use points, lines or polygons.`)
      return
    }
    if (isBoundary && geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      errors.push(`${where} is a ${geometry.type}. Boundary datasets must contain only Polygon or MultiPolygon features.`)
      return
    }

    const featureErrors: string[] = []
    if (!checkGeometry(geometry, where, featureErrors)) {
      errors.push(...featureErrors)
      return
    }

    const key = JSON.stringify(geometry)
    if (seenGeometries.has(key)) duplicateCount++
    else seenGeometries.add(key)

    positions.push(...positionsOf(geometry.coordinates))
    if (isBoundary) polygons.push(...collectPolygons(geometry, where, []))
  })

  if (mapping.nameField && missingName > 0) {
    warnings.push(`${missingName} feature(s) have no value in the name field.`)
  }
  if (!mapping.nameField && dataset.fields.length > 0) {
    warnings.push('No name field is selected. Choose the field that holds each feature name.')
  }
  if (!mapping.codeField) {
    warnings.push('No official code field is selected. Official codes are never invented, so records will have no code.')
  }
  if (duplicateCount > 0) {
    warnings.push(`${duplicateCount} feature(s) have exactly the same geometry as an earlier feature.`)
  }
  const typesPresent = Object.keys(countsByType)
  if (!isBoundary && typesPresent.length > 1) {
    warnings.push(`The file mixes geometry types (${typesPresent.join(', ')}). Check that this is intended.`)
  }
  if (isBoundary && errors.length === 0 && polygons.length === 0 && dataset.features.length > 0) {
    errors.push('The file contains no polygons.')
  }
  if (isBoundary) {
    warnings.push('Self-intersections are not checked automatically. Review the map preview before approving.')
  }

  const truncated = errors.length > MAX_REPORTED_ERRORS
  const criticalErrors = truncated
    ? [...errors.slice(0, MAX_REPORTED_ERRORS), 'More problems were found. Fix these and upload again.']
    : errors

  const bbox = positions.length > 0 ? computeBbox(positions) : null
  const crsNote = dataset.format === 'geojson'
    ? (dataset.crsName ? `Named in file: ${dataset.crsName}` : 'WGS 84 (GeoJSON default)')
    : dataset.format === 'kml'
      ? 'WGS 84 (KML standard)'
      : options.csvCrsConfirmed
        ? 'WGS 84, confirmed by the administrator'
        : 'Not confirmed'

  return {
    format: dataset.format,
    featureCount: dataset.features.length,
    countsByType,
    fields: dataset.fields,
    bbox,
    crsNote,
    criticalErrors,
    warnings,
    sampleRecords,
    boundaryGeometry: isBoundary && criticalErrors.length === 0 && polygons.length > 0
      ? { type: 'MultiPolygon', coordinates: polygons }
      : null,
  }
}

function computeBbox(positions: number[][]): BoundaryBbox {
  let min_lon = Infinity
  let max_lon = -Infinity
  let min_lat = Infinity
  let max_lat = -Infinity
  for (const [lon, lat] of positions) {
    min_lon = Math.min(min_lon, lon)
    max_lon = Math.max(max_lon, lon)
    min_lat = Math.min(min_lat, lat)
    max_lat = Math.max(max_lat, lat)
  }
  return { min_lon, max_lon, min_lat, max_lat }
}
