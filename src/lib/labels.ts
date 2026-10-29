import type { AlertCategory, AlertPriority, VerificationStatus } from './types'

export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  transport: 'Transport Advisory',
  ferry: 'Ferry Advisory',
  road: 'Road Closure',
  weather: 'Weather Warning',
  tourism: 'Tourism Notice',
  emergency: 'Emergency',
  government: 'Government Announcement',
  other: 'Notice',
}

export const PRIORITY_LABELS: Record<AlertPriority, string> = {
  critical: 'Critical',
  high: 'High Priority',
  medium: 'Medium',
  low: 'Low Priority',
  information: 'Information',
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  official: 'OFFICIAL',
  verified: 'VERIFIED',
  community: 'COMMUNITY',
  estimated: 'ESTIMATED',
  rejected: 'REJECTED',
  archived: 'ARCHIVED',
}

export function verificationClasses(status: VerificationStatus): string {
  switch (status) {
    case 'official':
      return 'bg-ocean-700 text-white'
    case 'verified':
      return 'bg-leaf-600 text-white'
    case 'community':
      return 'bg-sand-300 text-ocean-900'
    case 'estimated':
      return 'bg-terra-300 text-ocean-900'
    default:
      return 'bg-ocean-100 text-ocean-800'
  }
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}
