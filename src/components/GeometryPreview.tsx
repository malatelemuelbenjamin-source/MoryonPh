import type { BoundaryBbox, MultiPolygonCoordinates } from '../lib/geoJsonValidation'

const VIEW_WIDTH = 320

export function GeometryPreview({ coordinates, bbox }: { coordinates: MultiPolygonCoordinates; bbox: BoundaryBbox }) {
  const midLat = (bbox.min_lat + bbox.max_lat) / 2
  const lonScale = Math.cos((midLat * Math.PI) / 180)
  const width = (bbox.max_lon - bbox.min_lon) * lonScale
  const height = bbox.max_lat - bbox.min_lat
  if (width <= 0 || height <= 0) return null

  const scale = VIEW_WIDTH / width
  const viewHeight = height * scale
  const project = ([lon, lat]: number[]) =>
    `${((lon - bbox.min_lon) * lonScale * scale).toFixed(2)} ${((bbox.max_lat - lat) * scale).toFixed(2)}`
  const path = coordinates
    .flatMap((polygon) => polygon.map((ring) => `M${ring.map(project).join(' L')} Z`))
    .join(' ')

  return (
    <svg
      role="img"
      aria-label="Preview of the boundary shape"
      viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight.toFixed(2)}`}
      className="h-auto w-full rounded-lg bg-ocean-50"
    >
      <path
        d={path}
        fill="#38bdf8"
        fillOpacity={0.25}
        fillRule="evenodd"
        stroke="#0369a1"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
