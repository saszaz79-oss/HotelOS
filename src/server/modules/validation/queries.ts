import { prisma } from '@/lib/prisma';

/**
 * Validation Workspace queries (Validation Phase §1) — cross-hotel by
 * design, since this is an internal engineering tool for judging parser
 * quality across the install base, not a hotel-scoped feature. Callers MUST
 * gate access to Super Admin (Constitution §2 rule #4/#12) — these queries
 * do not themselves check hotel membership, unlike every other query in
 * this codebase, which is exactly why they must never be reachable from a
 * normal hotel-user route.
 */
export async function listReportsForValidation(take = 100) {
  return prisma.reportDocument.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      reportUpload: { select: { originalFilename: true, status: true, hotel: { select: { name: true } } } },
      groundTruth: { select: { id: true } },
      extractionJobs: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
  });
}

export async function getReportValidationDetail(reportDocumentId: string) {
  return prisma.reportDocument.findUnique({
    where: { id: reportDocumentId },
    include: {
      reportUpload: { include: { uploadedBy: { select: { displayName: true } }, hotel: { select: { name: true } } } },
      extractionJobs: { orderBy: { startedAt: 'asc' } },
      groundTruth: true,
      metrics: true,
    },
  });
}

export interface QualityDashboardStats {
  totalReports: number;
  byReportType: { reportType: string; count: number }[];
  byValidationStatus: { status: string; count: number }[];
  confidenceBuckets: { bucket: string; count: number }[];
  completenessBuckets: { bucket: string; count: number }[];
  manualCorrectionsCount: number;
  reportsWithParserWarnings: number;
  reportsWithGroundTruth: number;
}

function bucket(value: number | null, buckets: [string, number, number][]): string {
  if (value === null) return 'unknown';
  for (const [label, min, max] of buckets) {
    if (value >= min && value < max) return label;
  }
  return 'unknown';
}

const SCORE_BUCKETS: [string, number, number][] = [
  ['0-25%', 0, 0.25],
  ['25-50%', 0.25, 0.5],
  ['50-75%', 0.5, 0.75],
  ['75-100%', 0.75, 1.01],
];

/**
 * Data Quality Dashboard aggregate stats (Validation Phase §3). Every number
 * here is computed from real stored data — there is no synthetic/demo
 * fallback, so with zero reports processed this correctly returns zeros
 * rather than a misleading placeholder.
 */
export async function getQualityDashboardStats(): Promise<QualityDashboardStats> {
  const docs = await prisma.reportDocument.findMany({
    select: {
      reportType: true,
      validationStatus: true,
      extractionConfidence: true,
      completenessScore: true,
      parserWarnings: true,
      groundTruth: { select: { id: true } },
    },
  });

  const manualCorrections = await prisma.hotelMetric.count({ where: { isManuallyCorrected: true } });

  const byReportType = Object.entries(
    docs.reduce<Record<string, number>>((acc, d) => {
      acc[d.reportType] = (acc[d.reportType] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([reportType, count]) => ({ reportType, count }));

  const byValidationStatus = Object.entries(
    docs.reduce<Record<string, number>>((acc, d) => {
      const key = d.validationStatus ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ status, count }));

  const confidenceBuckets = SCORE_BUCKETS.map(([label]) => ({
    bucket: label,
    count: docs.filter((d) => bucket(d.extractionConfidence, SCORE_BUCKETS) === label).length,
  }));

  const completenessBuckets = SCORE_BUCKETS.map(([label]) => ({
    bucket: label,
    count: docs.filter((d) => bucket(d.completenessScore, SCORE_BUCKETS) === label).length,
  }));

  return {
    totalReports: docs.length,
    byReportType,
    byValidationStatus,
    confidenceBuckets,
    completenessBuckets,
    manualCorrectionsCount: manualCorrections,
    reportsWithParserWarnings: docs.filter((d) => (d.parserWarnings as unknown as unknown[]).length > 0).length,
    reportsWithGroundTruth: docs.filter((d) => d.groundTruth !== null).length,
  };
}
