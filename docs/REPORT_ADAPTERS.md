# Report Extraction Adapters

How HotelOS turns an uploaded Opera Cloud PDF into structured, validated
`HotelMetric` data — the modular adapter architecture built in EDI Phase 2.5,
and exactly what's required to add a new one.

## The core rule

**No adapter ships without being verified against a real sample of that
exact report.** Guessing a layout from a screenshot, a description, or "this
looks like the other one" is explicitly disallowed (Constitution: "Never Hide
Uncertainty," "never fabricate"). Where a real sample doesn't exist yet, or
its layout can't be reliably parsed even with a real sample in hand, the
correct outcome is an honest `missing` field — never a guessed value, never a
silently-substituted zero.

This isn't a style preference. The very first version of the Manager Flash
adapter in this codebase was built without a real sample, looked reasonable,
passed review, and shipped — and turned out to extract **nothing** against a
real export, because its core assumption about the text layout (label and
value adjacent on one line) was wrong. Two more bugs surfaced the same way
during Phase 2.5's real-sample verification pass (see "Bugs found this way,"
below) — both in code that had already been read, typechecked, and eyeballed
as correct. Only running the actual adapter against actual `unpdf`-extracted
text from actual PDFs caught them.

## Architecture

```
src/server/modules/report-extraction/
  types.ts                    <- ExtractedField, ExtractionAdapter interface
  adapters/
    index.ts                  <- selectAdapter(): picks the best-scoring adapter
    manager-flash.ts           <- real adapter
    reservation-statistics.ts  <- real adapter
    history-forecast.ts        <- real adapter
    day-mtd-ytd-statistics.ts  <- real adapter (deliberately partial — see below)
    generic-fallback.ts        <- catches anything with no matching adapter
    shared/
      block-parser.ts          <- shared positional parser (see below)
      field-builder.ts         <- shared field construction, confidence, date parsing
```

Every report type is one file implementing `ExtractionAdapter`:

```ts
interface ExtractionAdapter {
  reportType: ReportType;
  detect(fullText: string): number;   // 0-1: does this look like my report type?
  extract(fullText: string, pages: PdfPage[]): RawExtractionResult;
}
```

`selectAdapter()` runs every adapter's `detect()` against the uploaded PDF's
extracted text and picks the highest score. **Adding a new report type means
adding a new file and one line in `adapters/index.ts` — never modifying an
existing adapter or the shared pipeline.** This is what "additive" means in
practice: Manager Flash's code has not changed since Reservation Statistics,
History & Forecast, and Day/MTD/YTD Statistics were added on top of it.

## The shared block-parser (`shared/block-parser.ts`)

Every Opera Cloud report sampled so far shares one real, verified-against-real-
data layout quirk: `unpdf`'s text extraction does **not** preserve visual
reading order for these Crystal-Reports-style table exports. Instead, a page
comes out as one contiguous block of field labels, followed by one contiguous
block of value-lines, in the same order — `label[i]` corresponds to
`valueLine[i]` by **array position**, not by proximity in the raw text. A
value-line can hold 1–N numbers (a single day-only count, or a Day/Month/Year
triple).

`splitLabelValueBlock(lines, isHeaderLine)` finds the header line(s) that
separate the two blocks (e.g. a repeated-year row, or a "DAY MONTH YEAR" row)
and splits accordingly. `zipLabelsToValues(block)` pairs them up.

Adapters that fit this exact layout (Manager Flash, Reservation Statistics)
use this shared parser directly. Adapters whose real layout doesn't fit it
(History & Forecast is column-major; Day/MTD/YTD Statistics has a genuinely
scrambled raw-text order for most fields) use `splitLines`/`isNumericLine`
directly and anchor on a report-specific pattern instead — see each file's
own doc comment for why.

## Bugs found this way (read before touching the shared parser)

Both were caught by running the real adapters against real `unpdf` output —
not by code review, not by manual reasoning about the text — and both are now
permanent regression tests in `shared/block-parser.test.ts`.

1. **Boilerplate-as-labels.** Every real page opens with lines that contain
   letters but aren't field labels — date, time, hotel name, report title,
   filter description ("Room Class All", "Net"). A naive "any line with a
   letter before the header is a label" filter counted these as real labels,
   shifting every field's value by a constant offset (as much as 5 positions
   in the real Manager Flash sample — every single field was reading the
   wrong row). Fixed by taking only the **last N** letter-containing lines
   before the header, where N = the number of real value-lines found — the
   label:value pairing is always 1:1 immediately adjacent to the header, so
   this self-corrects regardless of how much boilerplate precedes it.

2. **Trailing footer counted as a value row.** Reservation Statistics' real
   sample ends with a "Market 2026" footer line after the Grand Total row —
   mixed letters and digits, not a label (no header follows it) and not real
   data. Taking "everything after the header to the end of the page" as
   value-lines swept this up too, inflating the value-line count by one,
   which fed back into fix #1 above and shifted every label by one position.
   Fixed by restricting value-lines to lines that are **purely numeric**
   (`isNumericLine`) — every real data row in every sample seen is all-numeric
   tokens.

A third, unrelated bug found the same way: Manager Flash's date detection
matched the *first* date-shaped substring in the whole document, which is
always the report's print/run timestamp (top of page 1) — not the actual
business date the report covers (the "Filter Calendar/Month to Date …"
line). Since a flash report is normally run the morning after close, these
two dates usually differ by one day. Fixed by anchoring on the "to Date"
filter label specifically, matching the pattern every other adapter already
used for its own date field.

## What's required to add a new adapter

1. **A real sample PDF or the exact real text extracted from one.** Not a
   description, not a screenshot, not "it's probably like the other one."
   Run it through `unpdf`'s `extractText` (same call the production pipeline
   uses — see `report-extraction/commands.ts`'s `extractPdfContent`) and look
   at the actual line order, not the visually-rendered table.
2. **Confirm the report's real title/heading text** — becomes `detect()`'s
   marker regex. Verify it doesn't collide with a similarly-named report
   (Reservation Statistics vs. "Reservation Statistics 1" needed a negative
   lookahead for exactly this reason).
3. **Map every field you intend to extract to its exact real label text and
   position** — not a guessed label, the literal string as it appears in the
   real extracted text. If the layout fits the shared block-parser's
   label-block/value-block pattern, use `splitLabelValueBlock` +
   `zipLabelsToValues` and build a `CanonicalField[]`-style mapping (see
   `manager-flash.ts`). If it doesn't, anchor on whatever structural landmark
   in the real text reliably identifies the row/line you need (see
   `history-forecast.ts`'s Subtotal/Subtotal/Total anchor, or
   `day-mtd-ytd-statistics.ts`'s 9-number-line anchor) — and say so in a doc
   comment, don't leave the next reader to reverse-engineer why.
4. **Decide the metric-key namespace.** If the report's numbers describe the
   same reporting period as the existing per-day `HotelMetric` keys (a single
   business date), reuse those keys. If they describe a different period
   (month-to-date, a forward-looking window, year-to-date), use a new
   prefixed key (`mtd_*`, `forecast_*`, `ytd_*`) — writing a period-aggregate
   into a single-day key silently corrupts whichever value is written second.
   Add the new keys to `METRIC_DEFINITIONS` in `prisma/seed.ts` (idempotent
   upsert, safe to re-run via the "Seed Production Platform Owner" GitHub
   Actions workflow — no migration needed for a metric definition).
5. **If any field's position in the real text is genuinely unreliable** (i.e.
   you tried multiple anchoring strategies against the real sample and none
   reconstruct it consistently), leave that field out entirely rather than
   guessing. `day-mtd-ytd-statistics.ts` does exactly this for two of its
   five visible metrics — extracting 3 reliable fields honestly beats
   extracting 5 fields where 2 are sometimes wrong.
6. Build every field through `buildMatchedField`/`buildMissingField` in
   `shared/field-builder.ts` — this is what keeps confidence scoring,
   evidence preservation (`sourceLabel`, `rawText`, `sourcePage`), and the
   "nothing is ever `verified` from automatic extraction alone" rule
   consistent across every adapter. Never construct an `ExtractedField`
   object by hand.
7. **Write adapter-level tests** using a synthetic fixture — mirror the real
   structure you just verified (same boilerplate pattern, same label/value
   layout, same anchor lines) but with fabricated round numbers. See
   "Test fixtures," below, for why real sample data can't be committed
   directly.
8. Add the adapter to the `ADAPTERS` array in `adapters/index.ts`. Nothing
   else in the pipeline changes.
9. Run `npm test`, `npm run typecheck`, `npm run lint` before considering it
   done.

## Test fixtures — why synthetic, not real

The real samples used to build and verify these four adapters cannot be
committed to this repository:

- **PII.** One of the six real files supplied during this phase (`Open
  Balance All.PDF`) contains real guest names in English and Arabic. It was
  never used to build an adapter and must never become a test fixture or
  otherwise enter git history.
- **Real revenue data.** Even the five PII-free samples contain this
  property's actual financial figures. Out of general data-minimization
  caution, committed test fixtures use the real *structure* (label wording,
  column order, boilerplate pattern) discovered from those samples, but
  fabricated round numbers — never the real amounts.

Every adapter's `.test.ts` file documents this in its fixture's own comment.
If you're adding a fifth adapter, follow the same pattern: verify against the
real file locally, then hand-build a structurally-identical synthetic fixture
for the committed test.

## Confidence tiers

- **0.75** (`BASE_CONFIDENCE` in `field-builder.ts`) — a field matched via a
  real, structurally-anchored positional parse (Manager Flash, Reservation
  Statistics). Reduced to **0.3** if the matched value falls outside a
  declared `plausibleRange` (e.g. an occupancy % above 100) — still surfaced,
  never hidden, just flagged as needing a closer look.
- **0.5** — applied on top of the above (`Math.min(field.confidence, 0.5)`)
  for History & Forecast and Day/MTD/YTD Statistics specifically, because
  their real layouts are genuinely more ambiguous (column-major /
  partially-scrambled raw text) than the other two. This is a deliberate,
  permanent differentiation — don't "fix" it to be uniform across adapters;
  it reflects real structural risk, not an oversight.
- **1.0** happens only when a human corrects a field — see
  `ExtractedField.corrected`. No field is ever auto-marked `verified`;
  everything automatically extracted lands as `needs_review`.

## Current coverage

| Report type | Adapter | Fields extracted | Notes |
|---|---|---|---|
| Manager Flash | `manager-flash.ts` | 17 of 23 canonical keys | 6 keys (`revpar`, `stayovers`, `open_balance`, `cash`, `card`, `city_ledger`) confirmed absent from this report type, not guessed |
| Reservation Statistics | `reservation-statistics.ts` | 5 (Grand Total row) | Per-market-segment breakdown (BAR/BOK/COR/…) detected but not yet persisted — no storage shape for dimensional data yet |
| History & Forecast | `history-forecast.ts` | 4 (report-wide Total row) | Day-by-day pickup/pace breakdown not yet extracted (future enhancement) |
| Day/MTD/YTD Statistics | `day-mtd-ytd-statistics.ts` | 3 of 5 visible Grand Total metrics | Room Revenue and Occupancy% deliberately not extracted — real raw-text order doesn't reconstruct them reliably |

Reservation Statistics 1 and Open Balance All fall through to
`generic-fallback.ts` — real samples exist for both but neither is a required
Analysis Session slot; no adapter has been built for them.
