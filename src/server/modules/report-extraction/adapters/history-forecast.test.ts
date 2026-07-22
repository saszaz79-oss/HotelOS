import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyForecastAdapter } from './history-forecast';
import type { PdfPage } from '../types';

/**
 * Synthetic fixture mirroring the real History & Forecast sample's
 * anchor structure: a numeric Total row immediately preceding a
 * "Subtotal"/"Subtotal"/"Total" label sequence — fabricated numbers only.
 */
const page1: PdfPage = {
  num: 1,
  text: [
    '01/01/26',
    '09:00',
    'Test Hotel Property',
    'History and Forecast Business Block',
    'Filter Detailed',
    'From Date 01/01/26',
    'To Date 31/01/26 Room Class All Room Type All',
    'history_forecastPage 1 of 1',
    'Date Occ. Rms.',
    '01/01/26',
    '02/01/26',
    '30',
    '25',
    '357 121 357 71,029.43 0 0.00 0 0.00 0 0.00 26.17% 71,029.43 198.96',
    'Subtotal',
    'Subtotal',
    'Total',
  ].join('\n'),
};

const pages = [page1];
const fullText = pages.map((p) => p.text).join('\n');

test('detect() matches on the real title marker', () => {
  assert.equal(historyForecastAdapter.detect(fullText), 0.85);
  assert.equal(historyForecastAdapter.detect('Some other report'), 0);
});

test('extract() reads the report-wide Total row anchored on the Subtotal/Subtotal/Total sequence', () => {
  const result = historyForecastAdapter.extract(fullText, pages);
  const byKey = new Map(result.fields.map((f) => [f.metricKey, f]));

  assert.equal(byKey.get('forecast_rooms_occupied')!.value, 357);
  assert.equal(byKey.get('forecast_occupancy_pct')!.value, 26.17);
  assert.equal(byKey.get('forecast_room_revenue')!.value, 71029.43);
  assert.equal(byKey.get('forecast_adr')!.value, 198.96);

  for (const f of result.fields) {
    assert.equal(f.status, 'needs_review');
    assert.equal(f.confidence, 0.5, 'History & Forecast fields must stay at the deliberately lower confidence tier');
  }
});

test('detectedReportDate is always null — this report covers a date range, never a single business date', () => {
  const result = historyForecastAdapter.extract(fullText, pages);
  assert.equal(result.detectedReportDate, null);
  assert.ok(result.parserWarnings.some((w) => /queried date range/i.test(w)));
});

test('extract() reports all fields missing when no Total row is found, never guesses one', () => {
  const otherPage: PdfPage = { num: 1, text: 'History and Forecast Business Block\nNo matching Subtotal/Total sequence here' };
  const result = historyForecastAdapter.extract(otherPage.text, [otherPage]);
  assert.ok(result.fields.every((f) => f.status === 'missing'));
  assert.ok(result.parserWarnings.some((w) => /No report-wide "Total" row found/i.test(w)));
});
