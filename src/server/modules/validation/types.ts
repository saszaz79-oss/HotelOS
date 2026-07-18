export type FieldComparisonResult = 'match' | 'mismatch' | 'false_positive' | 'false_negative';

export interface FieldComparison {
  metricKey: string;
  expected: number | null;
  extracted: number | null;
  result: FieldComparisonResult;
}

export interface AccuracyReport {
  reportDocumentId: string;
  comparisons: FieldComparison[];
  /** matches / (matches + mismatches + falsePositives + falseNegatives) — undefined fields (both null) are excluded, not counted as free accuracy. */
  accuracy: number;
  matches: number;
  mismatches: number;
  falsePositives: number;
  falseNegatives: number;
}
