import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reservationStatisticsAdapter } from './reservation-statistics';
import type { PdfPage } from '../types';

/**
 * Synthetic fixture mirroring the real Reservation Statistics sample's
 * structure (boilerplate header, per-market label rows, one shared column
 * header, one value line per market ending in Grand Total, then a trailing
 * "Market <year>" footer line) — fabricated numbers only.
 */
const page1: PdfPage = {
  num: 1,
  text: [
    '01/01/26',
    '09:00',
    'Reservation Statistics',
    'Calendar/Month 2026, 01',
    'Room Class All',
    'Room Type All',
    'Option Market',
    'Net Revenue',
    'Filter',
    'Test Hotel Property',
    'res_statisticsPage 1 of 1',
    'BAR',
    'BOK',
    'Grand Total',
    'No. of Rooms Room Revenue F&B Revenue Misc Revenue ADR % Occ. No. of Guest % Multi Occ. Single Occ. Multi Occ.',
    '100 20000.00 500.00 0.04 200.00 40.00 200 10.00 5 50',
    '150 30000.00 750.00 1.84 200.00 60.00 300 15.00 8 75',
    '250 50000.00 1250.00 1.88 200.00 50.00 500 12.50 13 125',
    'Market 2026',
  ].join('\n'),
};

const pages = [page1];
const fullText = pages.map((p) => p.text).join('\n');

test('detect() matches on the real title, excludes "Reservation Statistics 1"', () => {
  assert.equal(reservationStatisticsAdapter.detect(fullText), 0.9);
  assert.equal(reservationStatisticsAdapter.detect('Reservation Statistics 1\nsome other layout'), 0);
});

test('REGRESSION: Grand Total row is found and correctly parsed despite a trailing non-numeric footer line', () => {
  const result = reservationStatisticsAdapter.extract(fullText, pages);
  const byKey = new Map(result.fields.map((f) => [f.metricKey, f]));

  assert.equal(byKey.get('mtd_rooms_sold')!.value, 250);
  assert.equal(byKey.get('mtd_room_revenue')!.value, 50000);
  assert.equal(byKey.get('mtd_adr')!.value, 200);
  assert.equal(byKey.get('mtd_occupancy_pct')!.value, 50);
  assert.equal(byKey.get('mtd_total_guests')!.value, 500);

  for (const f of result.fields) assert.equal(f.status, 'needs_review');
});

test('detectedReportDate reads the unambiguous Calendar/Month filter (year, month, no day guessing)', () => {
  const result = reservationStatisticsAdapter.extract(fullText, pages);
  assert.ok(result.detectedReportDate);
  assert.equal(result.detectedReportDate!.toISOString().slice(0, 10), '2026-01-01');
});

test('extract() reports all fields missing and warns when no Grand Total row is found', () => {
  const otherPage: PdfPage = { num: 1, text: 'Reservation Statistics\nCalendar/Month 2026, 01\nNo matching table here' };
  const result = reservationStatisticsAdapter.extract(otherPage.text, [otherPage]);
  assert.ok(result.fields.every((f) => f.status === 'missing'));
  assert.ok(result.parserWarnings.some((w) => /No "Grand Total" row found/i.test(w)));
});
