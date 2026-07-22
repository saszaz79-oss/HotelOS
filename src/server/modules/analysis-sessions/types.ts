import type { ReportType } from '@prisma/client';

/**
 * The 4 report types an Analysis Session requires before "Start Executive
 * Analysis" is available (EDI Phase 2). Shared between the Upload page
 * (slot cards) and `startExecutiveAnalysisAction` (server-side gate — the
 * client-side check is UX only, this is what actually enforces it).
 */
export const REQUIRED_SESSION_REPORT_TYPES: ReportType[] = [
  'RESERVATION_STATISTICS',
  'MANAGER_FLASH',
  'HISTORY_FORECAST',
  'DAY_MTD_YTD_STATISTICS',
];
