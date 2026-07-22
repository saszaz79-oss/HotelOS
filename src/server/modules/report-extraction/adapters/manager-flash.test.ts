import { test } from 'node:test';
import assert from 'node:assert/strict';
import { managerFlashAdapter } from './manager-flash';
import type { PdfPage } from '../types';

/**
 * Synthetic fixture — NOT a real Opera Cloud export. Mirrors the real
 * structure discovered and verified against a real Manager Flash sample
 * during EDI Phase 2.5 (boilerplate header block, label block, "2026 2026
 * 2026"/"DAY MONTH YEAR" header, then a same-order value block; page 2
 * carries the revenue/ADR fields), but every number here is fabricated —
 * never the real report's revenue figures.
 */
const page1: PdfPage = {
  num: 1,
  text: [
    '01/01/26',
    '09:00',
    'Test Hotel Property',
    'Manager - flash',
    'Filter Calendar/Month to Date 31/12/25 manager_reportPage 1 of',
    'Room Class All',
    'Net',
    '1',
    'Total Rooms in Hotel',
    'Rooms Occupied',
    'Out of Order Rooms',
    'Out of Service Rooms',
    'Complimentary Rooms',
    'House Use Rooms',
    'In-House Adults',
    'In-House Children',
    'Total In-House Persons',
    '% Rooms Occupied',
    'Arrival Rooms',
    'Departure Rooms',
    'No Show Rooms',
    'Cancelled Reservations for Today',
    '2026 2026 2026',
    'DAY MONTH YEAR',
    '50 900 5000', // Total Rooms in Hotel
    '40 700 4000', // Rooms Occupied
    '0 0 10', // Out of Order Rooms
    '0 0 2', // Out of Service Rooms
    '1 5 20', // Complimentary Rooms
    '0 1 5', // House Use Rooms
    '65 1200 6500', // In-House Adults
    '5 100 500', // In-House Children
    '70 1300 7000', // Total In-House Persons
    '80.00 77.78 80.00', // % Rooms Occupied
    '10 200 1000', // Arrival Rooms
    '8 190 950', // Departure Rooms
    '1 20 100', // No Show Rooms
    '0 5 50', // Cancelled Reservations for Today
  ].join('\n'),
};

const page2: PdfPage = {
  num: 2,
  text: [
    '01/01/26',
    '09:00',
    'Test Hotel Property',
    'Manager - flash',
    'Filter Calendar/Month to Date 31/12/25 manager_reportPage 2 of',
    'Room Class All',
    'Net',
    '1',
    'Room Revenue',
    'Total Revenue',
    'ADR',
    '2026 2026 2026',
    'DAY MONTH YEAR',
    '5000.00 90000.00 500000.00', // Room Revenue
    '5500.00 99000.00 550000.00', // Total Revenue
    '100.00 128.57 125.00', // ADR
  ].join('\n'),
};

const pages = [page1, page2];
const fullText = pages.map((p) => p.text).join('\n');

test('detect() matches on the real title marker ("Manager - flash", hyphenated)', () => {
  assert.equal(managerFlashAdapter.detect(fullText), 0.9);
  assert.equal(managerFlashAdapter.detect('Some other report entirely'), 0);
});

test('extract() reads every present field from the correct Day column, unshifted by boilerplate', () => {
  const result = managerFlashAdapter.extract(fullText, pages);
  const byKey = new Map(result.fields.map((f) => [f.metricKey, f]));

  assert.equal(byKey.get('rooms_available')!.value, 50);
  assert.equal(byKey.get('rooms_sold')!.value, 40);
  assert.equal(byKey.get('occupancy_pct')!.value, 80);
  assert.equal(byKey.get('out_of_order_rooms')!.value, 0);
  assert.equal(byKey.get('out_of_inventory_rooms')!.value, 0);
  assert.equal(byKey.get('complimentary_rooms')!.value, 1);
  assert.equal(byKey.get('house_use_rooms')!.value, 0);
  assert.equal(byKey.get('adults')!.value, 65);
  assert.equal(byKey.get('children')!.value, 5);
  assert.equal(byKey.get('total_guests')!.value, 70);
  assert.equal(byKey.get('arrivals')!.value, 10);
  assert.equal(byKey.get('departures')!.value, 8);
  assert.equal(byKey.get('no_shows')!.value, 1);
  assert.equal(byKey.get('cancellations')!.value, 0);
  assert.equal(byKey.get('room_revenue')!.value, 5000);
  assert.equal(byKey.get('total_revenue')!.value, 5500);
  assert.equal(byKey.get('adr')!.value, 100);

  for (const key of ['rooms_available', 'rooms_sold', 'occupancy_pct', 'room_revenue']) {
    assert.equal(byKey.get(key)!.status, 'needs_review', `${key} must never be auto-marked verified`);
  }
});

test('extract() never fabricates fields genuinely absent from Manager Flash', () => {
  const result = managerFlashAdapter.extract(fullText, pages);
  const byKey = new Map(result.fields.map((f) => [f.metricKey, f]));
  for (const key of ['revpar', 'stayovers', 'open_balance', 'cash', 'card', 'city_ledger']) {
    const field = byKey.get(key);
    assert.ok(field, `${key} must still appear in the field list`);
    assert.equal(field!.status, 'missing');
    assert.equal(field!.value, null);
  }
});

test('REGRESSION: detectedReportDate uses the "to Date" filter anchor, not the print/run timestamp', () => {
  // The fixture's print timestamp (01/01/26) deliberately differs from the
  // filter's business date (31/12/25) — a flash report is normally run the
  // morning after close, so these two dates are almost always different in
  // real exports. A naive "first date-shaped substring" match would
  // incorrectly return the print date.
  const result = managerFlashAdapter.extract(fullText, pages);
  assert.ok(result.detectedReportDate);
  assert.equal(result.detectedReportDate!.toISOString().slice(0, 10), '2025-12-31');
});

test('extract() surfaces a parser warning when the report does not match the expected layout at all', () => {
  const emptyPages: PdfPage[] = [{ num: 1, text: 'Not a Manager Flash report' }];
  const result = managerFlashAdapter.extract(emptyPages[0]!.text, emptyPages);
  assert.ok(result.parserWarnings.some((w) => /No label\/value block detected/i.test(w)));
  assert.ok(result.fields.every((f) => f.status === 'missing'));
});
