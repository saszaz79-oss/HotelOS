import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayMtdYtdStatisticsAdapter } from './day-mtd-ytd-statistics';
import type { PdfPage } from '../types';

/**
 * Synthetic fixture mirroring the real Day/MTD/YTD Statistics sample's one
 * reliable anchor: a 9-number Day/Month/Year summary line immediately after
 * the report title — fabricated numbers only. Room Revenue and Occupancy%
 * are deliberately absent from this fixture too, matching the real
 * report's genuinely unreliable raw-text order for those two fields.
 */
const page1: PdfPage = {
  num: 1,
  text: [
    '01/01/26Test Hotel Property',
    'For Date 31/12/25',
    'Room Class All',
    '09:00',
    'stat_dmy_seg',
    'Day/MTD/YTD Statistics',
    'Page 1 of 1',
    '40 200.00 78 700 190.00 1400 4000 210.00 7000',
  ].join('\n'),
};

const pages = [page1];
const fullText = pages.map((p) => p.text).join('\n');

test('detect() matches on the real title marker', () => {
  assert.equal(dayMtdYtdStatisticsAdapter.detect(fullText), 0.85);
  assert.equal(dayMtdYtdStatisticsAdapter.detect('Some other report'), 0);
});

test('extract() reads only the three reliably-anchored Year-column metrics from the 9-number line', () => {
  const result = dayMtdYtdStatisticsAdapter.extract(fullText, pages);
  const byKey = new Map(result.fields.map((f) => [f.metricKey, f]));

  assert.equal(byKey.get('ytd_rooms_sold')!.value, 4000);
  assert.equal(byKey.get('ytd_adr')!.value, 210);
  assert.equal(byKey.get('ytd_total_guests')!.value, 7000);

  for (const f of result.fields) {
    assert.equal(f.status, 'needs_review');
    assert.equal(f.confidence, 0.5);
  }
});

test('never fabricates Room Revenue or Occupancy% for this report type — genuinely not extracted, not just absent from the fixture', () => {
  const result = dayMtdYtdStatisticsAdapter.extract(fullText, pages);
  const keys = result.fields.map((f) => f.metricKey);
  assert.ok(!keys.includes('ytd_room_revenue'));
  assert.ok(!keys.includes('ytd_occupancy_pct'));
  assert.equal(result.fields.length, 3, 'this adapter must only ever produce the 3 reliably-anchored fields');
});

test('extract() reports all fields missing when the 9-number anchor line cannot be found', () => {
  const otherPage: PdfPage = { num: 1, text: 'Day/MTD/YTD Statistics\nNo anchor line here at all' };
  const result = dayMtdYtdStatisticsAdapter.extract(otherPage.text, [otherPage]);
  assert.ok(result.fields.every((f) => f.status === 'missing'));
  assert.ok(result.parserWarnings.some((w) => /Could not locate the expected 9-number/i.test(w)));
});
