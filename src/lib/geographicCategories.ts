export const UPLOAD_CATEGORIES = [
  { value: 'island_boundary', label: 'Island boundaries' },
  { value: 'municipal_boundary', label: 'Municipality boundaries' },
  { value: 'barangay_boundary', label: 'Barangay boundaries' },
  { value: 'coastline', label: 'Coastlines' },
  { value: 'roads', label: 'Roads' },
  { value: 'buildings', label: 'Buildings' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'public_facilities', label: 'Public facilities' },
  { value: 'transport_routes', label: 'Transportation routes' },
  { value: 'transport_terminals', label: 'Transportation terminals' },
  { value: 'landmarks', label: 'Geographic landmarks' },
  { value: 'other_approved', label: 'Other approved geographic datasets' },
] as const

export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number]['value']

export const BOUNDARY_CATEGORIES: readonly UploadCategory[] = ['island_boundary', 'municipal_boundary', 'barangay_boundary']

export function isBoundaryCategory(category: string): boolean {
  return (BOUNDARY_CATEGORIES as readonly string[]).includes(category)
}

export function categoryLabel(category: string): string {
  return UPLOAD_CATEGORIES.find((option) => option.value === category)?.label ?? category
}
