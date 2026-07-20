import type { StatusTone } from '@/components/ui/StatusBadge';

/** Hotel.status → badge tone, shared across every admin screen that lists hotels. */
export function hotelStatusTone(status: string): StatusTone {
  if (status === 'active') return 'positive';
  if (status === 'suspended') return 'warning';
  return 'neutral'; // archived
}

/** User.status → badge tone. */
export function userStatusTone(status: string): StatusTone {
  return status === 'active' ? 'positive' : 'neutral';
}

/** ReportUpload.status → badge tone. */
export function reportStatusTone(status: string): StatusTone {
  if (status === 'complete') return 'positive';
  if (status === 'error') return 'critical';
  if (status === 'needs_review') return 'warning';
  return 'info'; // uploaded, processing
}
