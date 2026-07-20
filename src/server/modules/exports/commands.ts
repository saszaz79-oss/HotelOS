import { prisma } from '@/lib/prisma';
import type { Language } from '@prisma/client';

/**
 * Audit trail for the Executive PDF export (Phase 11) — there is no
 * server-generated PDF file to store (the export relies on the browser's
 * own print-to-PDF for correct Arabic shaping), so storageKey stays null;
 * this row exists purely to record who exported what, for when.
 */
export async function recordExport(hotelId: string, userId: string, language: Language, periodDate: Date): Promise<void> {
  await prisma.exportedReport.create({
    data: {
      hotelId,
      generatedByUserId: userId,
      language,
      periodStart: periodDate,
      periodEnd: periodDate,
      status: 'generated',
    },
  });
}
