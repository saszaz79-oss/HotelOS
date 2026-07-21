import type { ReportType } from '@prisma/client';
import type { getDictionary } from '@/i18n/config';

type ReportTypeDict = ReturnType<typeof getDictionary>['reportsCommon']['reportTypes'];

/** Human-readable label for a raw ReportType enum value — never show `MANAGER_FLASH` etc. verbatim to a user. */
export function reportTypeLabel(type: ReportType, dict: ReportTypeDict): string {
  return dict[type];
}
