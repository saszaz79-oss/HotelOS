import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { ExtractedField } from '@/server/modules/report-extraction/types';
import type { AccuracyReport, FieldComparison, FieldComparisonResult } from './types';

const TOLERANCE = 0.01;

function valuesMatch(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom <= TOLERANCE;
}

/**
 * Records engineer-entered ground truth for a report (Validation Phase §9,
 * "Real Data Mode") — an internal validation action, not part of the normal
 * report workflow, so it is not wired into any hotel-user-facing flow.
 */
export async function recordGroundTruth(
  reportDocumentId: string,
  expectedFields: Record<string, number | null>,
  recordedByUserId: string,
  notes?: string
): Promise<void> {
  await prisma.extractionGroundTruth.upsert({
    where: { reportDocumentId },
    update: { expectedFields: expectedFields as unknown as Prisma.InputJsonValue, notes, recordedByUserId },
    create: {
      reportDocumentId,
      expectedFields: expectedFields as unknown as Prisma.InputJsonValue,
      notes,
      recordedByUserId,
    },
  });
}

/**
 * Compares extracted values against recorded ground truth (Validation Phase
 * §9). Returns null when no ground truth has been recorded — the caller
 * must show "not yet measured," never a fabricated accuracy figure
 * (Constitution "Never Hide Uncertainty").
 */
export async function compareExtractionAccuracy(reportDocumentId: string): Promise<AccuracyReport | null> {
  const doc = await prisma.reportDocument.findUnique({
    where: { id: reportDocumentId },
    include: { groundTruth: true },
  });
  if (!doc?.groundTruth) return null;

  const extracted = new Map((doc.extractedFields as unknown as ExtractedField[]).map((f) => [f.metricKey, f.value]));
  const expected = doc.groundTruth.expectedFields as Record<string, number | null>;

  const comparisons: FieldComparison[] = [];
  for (const [metricKey, expectedValue] of Object.entries(expected)) {
    const extractedValue = extracted.get(metricKey) ?? null;

    let result: FieldComparisonResult;
    if (expectedValue === null && extractedValue === null) {
      continue; // both agree nothing should be here — not counted (see AccuracyReport doc comment)
    } else if (expectedValue === null && extractedValue !== null) {
      result = 'false_positive';
    } else if (expectedValue !== null && extractedValue === null) {
      result = 'false_negative';
    } else if (valuesMatch(expectedValue!, extractedValue!)) {
      result = 'match';
    } else {
      result = 'mismatch';
    }

    comparisons.push({ metricKey, expected: expectedValue, extracted: extractedValue, result });
  }

  const matches = comparisons.filter((c) => c.result === 'match').length;
  const mismatches = comparisons.filter((c) => c.result === 'mismatch').length;
  const falsePositives = comparisons.filter((c) => c.result === 'false_positive').length;
  const falseNegatives = comparisons.filter((c) => c.result === 'false_negative').length;
  const total = comparisons.length;

  return {
    reportDocumentId,
    comparisons,
    accuracy: total === 0 ? 0 : matches / total,
    matches,
    mismatches,
    falsePositives,
    falseNegatives,
  };
}
