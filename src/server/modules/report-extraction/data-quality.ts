import type { ExtractedField } from './types';

export interface QualityNote {
  metricKey: string;
  issue: 'missing' | 'low_confidence' | 'implausible' | 'ambiguous';
  message: string;
}

export interface DataQualityResult {
  completenessScore: number;
  confidenceScore: number;
  validationStatus: 'passed' | 'flagged' | 'failed';
  qualityNotes: QualityNote[];
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Plausibility checks (PRD §4, Architecture §33). Cross-field checks run
 * only when both sides are present — missing data is never treated as a
 * plausibility failure (Constitution: never invent, never penalize absence
 * as if it were an error).
 */
function checkPlausibility(fields: Map<string, ExtractedField>, notes: QualityNote[]): boolean {
  let allPlausible = true;

  const occupancy = fields.get('occupancy_pct');
  if (occupancy?.value !== null && occupancy?.value !== undefined) {
    if (occupancy.value < 0 || occupancy.value > 100) {
      notes.push({ metricKey: 'occupancy_pct', issue: 'implausible', message: 'Occupancy % outside 0-100 range' });
      allPlausible = false;
    }
  }

  const sold = fields.get('rooms_sold')?.value;
  const available = fields.get('rooms_available')?.value;
  if (sold !== null && sold !== undefined && available !== null && available !== undefined) {
    if (sold > available) {
      notes.push({ metricKey: 'rooms_sold', issue: 'implausible', message: 'Rooms sold exceeds rooms available' });
      allPlausible = false;
    }
  }

  return allPlausible;
}

/**
 * Data Quality Engine scoring (Architecture §33). Transparent by the same
 * discipline as the Health Score — qualityNotes is the auditable breakdown,
 * never just a bare number.
 */
export function assessDataQuality(fields: ExtractedField[]): DataQualityResult {
  const byKey = new Map(fields.map((f) => [f.metricKey, f]));
  const notes: QualityNote[] = [];

  const foundFields = fields.filter((f) => f.value !== null);
  const completenessScore = fields.length === 0 ? 0 : foundFields.length / fields.length;

  const confidenceScore =
    foundFields.length === 0 ? 0 : foundFields.reduce((sum, f) => sum + f.confidence, 0) / foundFields.length;

  for (const field of fields) {
    if (field.value === null) {
      notes.push({ metricKey: field.metricKey, issue: 'missing', message: `${field.labelEn} not found in report text` });
    } else if (field.ambiguous) {
      notes.push({
        metricKey: field.metricKey,
        issue: 'ambiguous',
        message: `${field.labelEn} matched multiple conflicting values in the source text — resolve manually`,
      });
    } else if (field.confidence < LOW_CONFIDENCE_THRESHOLD) {
      notes.push({
        metricKey: field.metricKey,
        issue: 'low_confidence',
        message: `${field.labelEn} extracted with low confidence — verify against source`,
      });
    }
  }

  const plausible = checkPlausibility(byKey, notes);

  let validationStatus: DataQualityResult['validationStatus'] = 'passed';
  if (!plausible) {
    validationStatus = 'failed';
  } else if (notes.length > 0) {
    validationStatus = 'flagged';
  }

  return { completenessScore, confidenceScore, validationStatus, qualityNotes: notes };
}
