import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNumericLine, splitLabelValueBlock, splitLines, zipLabelsToValues } from './block-parser';

const isDmyHeader = (line: string): boolean => {
  if (/^\d{4}(\s+\d{4})*$/.test(line)) return true;
  const words = line.split(/\s+/);
  return words.length > 0 && words.every((w) => /^(DAY|MONTH|YEAR)$/i.test(w));
};

test('splitLines trims and drops blank lines', () => {
  const lines = splitLines('  A  \n\nB\n   \nC  ');
  assert.deepEqual(lines, ['A', 'B', 'C']);
});

test('isNumericLine accepts money/percent tokens, rejects mixed text', () => {
  assert.equal(isNumericLine('44 924 8888'), true);
  assert.equal(isNumericLine('90.91 80.52 43.92'), true);
  assert.equal(isNumericLine('142,893.78 9,867.90'), true);
  assert.equal(isNumericLine('26.17%'), true);
  assert.equal(isNumericLine('Market 2026'), false);
  assert.equal(isNumericLine('Grand Total'), false);
});

test('REGRESSION: leading report boilerplate (hotel name, title, filter lines) must not be misread as field labels', () => {
  // Mirrors the real Opera Cloud page structure that broke this parser the
  // first time it ran against a real sample: several boilerplate lines
  // before the label block contain letters (hotel name, report title,
  // filter tags), which a naive "any line with a letter" filter would count
  // as fake leading labels — shifting every real label out of alignment
  // with its value line. See block-parser.ts's module doc for the full story.
  const page = [
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
    '2026 2026 2026',
    'DAY MONTH YEAR',
    '50 900 5000',
    '40 700 4000',
    '0 0 10',
  ];
  const lines = splitLines(page.join('\n'));
  const block = splitLabelValueBlock(lines, isDmyHeader);
  assert.ok(block);
  assert.deepEqual(block!.labels, ['Total Rooms in Hotel', 'Rooms Occupied', 'Out of Order Rooms']);
  const zipped = zipLabelsToValues(block!);
  assert.deepEqual(
    zipped.map((z) => [z.label, z.values]),
    [
      ['Total Rooms in Hotel', [50, 900, 5000]],
      ['Rooms Occupied', [40, 700, 4000]],
      ['Out of Order Rooms', [0, 0, 10]],
    ]
  );
});

test('REGRESSION: a trailing non-numeric footer line after the value block must not be counted as a value row', () => {
  // Mirrors the real Reservation Statistics sample, which ends with a
  // "Market 2026" footer line after the Grand Total row — a line with both
  // letters and digits, so it isn't a label (no header follows it) but also
  // isn't a real data row. Counting it as a value line inflates the
  // value-line count, which throws off the label-count correction above and
  // shifts every label by one position.
  const page = [
    'Reservation Statistics',
    'Calendar/Month 2026, 01',
    'Room Class All',
    'Test Hotel Property',
    'res_statisticsPage 1 of 1',
    'BAR',
    'Grand Total',
    'No. of Rooms Room Revenue F&B Revenue Misc Revenue ADR % Occ. No. of Guest % Multi Occ. Single Occ. Multi Occ.',
    '100 20000.00 500.00 0.00 200.00 40.00 200 10.00 5 50',
    '150 30000.00 750.00 0.00 200.00 60.00 300 15.00 8 75',
    'Market 2026',
  ];
  const lines = splitLines(page.join('\n'));
  const isResHeader = (line: string) => /No\.\s*of\s*Rooms\s+Room\s+Revenue/i.test(line);
  const block = splitLabelValueBlock(lines, isResHeader);
  assert.ok(block);
  assert.deepEqual(block!.labels, ['BAR', 'Grand Total']);
  const zipped = zipLabelsToValues(block!);
  const grandTotal = zipped.find((z) => z.label === 'Grand Total');
  assert.ok(grandTotal, 'Grand Total row must be found');
  assert.deepEqual(grandTotal!.values, [150, 30000.0, 750.0, 0.0, 200.0, 60.0, 300, 15.0, 8, 75]);
});

test('splitLabelValueBlock returns null when no header line is found (never guesses a layout)', () => {
  const lines = splitLines('Some Unrelated Report\nWith no matching header line at all');
  const block = splitLabelValueBlock(lines, isDmyHeader);
  assert.equal(block, null);
});

test('zipLabelsToValues silently skips a label with no corresponding value line (caller turns this into a missing field, not a crash)', () => {
  const block = { labels: ['A', 'B', 'C'], valueLines: ['1 2 3', '4 5 6'] };
  const zipped = zipLabelsToValues(block);
  assert.equal(zipped.length, 2);
  assert.deepEqual(zipped.map((z) => z.label), ['A', 'B']);
});
