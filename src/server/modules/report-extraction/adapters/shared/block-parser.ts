/**
 * Shared positional block parser (EDI Phase 2.5 — modular extraction
 * architecture) — the layout every Opera Cloud report sampled so far
 * actually uses: labels are emitted as one contiguous text block, followed
 * by a second contiguous block of value-lines in the SAME order (this is a
 * `unpdf`/PDF-text-extraction artifact of table-column layouts, not visual
 * reading order). Verified line-by-line against real Manager Flash and
 * Reservation Statistics samples during this phase — a proximity-based
 * "label immediately followed by its number" regex (the pre-Phase-2.5
 * Manager Flash adapter's approach) does NOT match this real layout at
 * all, since dozens of other label lines sit between a label and its
 * value. This is the actual bug that made the original adapter
 * unvalidated-and-wrong, not just unvalidated.
 *
 * A value-line may hold 1..N numbers (e.g. a single day-only count like
 * "Clean Rooms: 3" vs. a Day/Month/Year triple) — never assumed fixed-width.
 */

export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const NUMERIC_TOKEN = /^-?[\d,]+(?:\.\d+)?%?$/;

export function isNumericLine(line: string): boolean {
  const tokens = line.split(/\s+/);
  return tokens.length > 0 && tokens.every((t) => NUMERIC_TOKEN.test(t));
}

export function parseNumberToken(token: string): number {
  return Number(token.replace(/,/g, '').replace(/%$/, ''));
}

export interface LabelValueBlock {
  /** Ordered label text, one per expected value-row. */
  labels: string[];
  /** Ordered value-lines immediately following the header, same order as `labels`. */
  valueLines: string[];
}

/**
 * Splits a page's lines into a label block and a value-line block, given a
 * predicate that recognizes the header line(s) separating them (e.g. a
 * "DAY MONTH YEAR" column-header row, or a leading "2026 2026 2026" year
 * row). Everything from the first non-header line after the header run is a
 * value-line. Returns null if no header line is found at all (report
 * doesn't match this adapter's expected layout — the caller should treat
 * this as a failed detection, never guess).
 *
 * BUG FOUND DURING EDI PHASE 2.5 REAL-SAMPLE VERIFICATION (not a
 * hypothetical — this shifted every single field in both Manager Flash and
 * Reservation Statistics by a constant offset the first time this was run
 * against real PDFs): every real report page opens with boilerplate lines
 * before the true label block — date, time, hotel name, report title,
 * filter description, "Room Class All"/"Net" or similar filter tags, an
 * internal report name + "Page X of Y" fragment. Several of those lines
 * contain letters (hotel name, title, "Room Class All"...), so a naive "any
 * line with a letter before the header is a label" filter pulls in that
 * boilerplate as fake leading labels, shifting every real label's position
 * relative to its value-line by however many boilerplate lines happened to
 * precede it — silently wrong, not silently missing, which is worse.
 *
 * Fix: the report family this parser targets guarantees exactly one
 * value-line per real label, and the real label block is always the run of
 * letter-containing lines immediately adjacent to the header (boilerplate
 * always comes earlier on the page, never interleaved with real labels).
 * So instead of guessing where boilerplate ends, take the LAST
 * `valueLines.length` letter-containing lines before the header — that is
 * exactly the real label block, self-correcting regardless of how much or
 * what boilerplate precedes it. This generalizes to any future report in
 * this layout family without per-report special-casing.
 *
 * A second real bug found the same way: naively taking "everything after
 * the header run to the end of the page" as value-lines also swept up a
 * trailing footer line (Reservation Statistics' real sample ends with a
 * "Market 2026" footer line after its Grand Total row) — a line with both
 * letters and digits, so it isn't a label (no header line follows it) but
 * also isn't a real data row. Its presence inflated the value-line count by
 * one, which fed back into the label-count fix above and shifted every
 * label by one position. Fixed by restricting value-lines to lines that are
 * PURELY numeric (`isNumericLine`) — every real data row in every sample
 * seen is all-numeric tokens; anything mixing letters and numbers after the
 * header is page furniture, not a value row.
 */
export function splitLabelValueBlock(lines: string[], isHeaderLine: (line: string) => boolean): LabelValueBlock | null {
  const headerStart = lines.findIndex(isHeaderLine);
  if (headerStart === -1) return null;

  let valueStart = headerStart;
  while (valueStart < lines.length && isHeaderLine(lines[valueStart]!)) valueStart++;

  const valueLines = lines.slice(valueStart).filter(isNumericLine);
  const candidateLabels = lines.slice(0, headerStart).filter((l) => /[a-zA-Z؀-ۿ]/.test(l));
  const labels = valueLines.length > 0 ? candidateLabels.slice(-valueLines.length) : candidateLabels;
  return { labels, valueLines };
}

export interface ZippedValue {
  label: string;
  /** All numeric tokens found on this label's value-line, in document order (e.g. [day, month, year] or just [day]). */
  values: number[];
  rawLine: string;
}

/**
 * Zips labels to their value-lines by array position (see module doc for
 * why this is the correct strategy for this report family). A label with
 * no corresponding value-line, or whose "value-line" turns out to contain
 * no numeric tokens at all, is silently skipped here — the caller's
 * field-builder is responsible for turning "label present, no value found"
 * into an honest `missing` field, not this low-level zipper.
 */
export function zipLabelsToValues(block: LabelValueBlock): ZippedValue[] {
  const results: ZippedValue[] = [];
  for (let i = 0; i < block.labels.length; i++) {
    const label = block.labels[i]!;
    const line = block.valueLines[i];
    if (!line) continue;
    const tokens = line.split(/\s+/).filter((t) => NUMERIC_TOKEN.test(t));
    if (tokens.length === 0) continue;
    results.push({ label, values: tokens.map(parseNumberToken), rawLine: line });
  }
  return results;
}
