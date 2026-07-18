# HotelOS Parser Documentation

Generated as part of the Validation Phase (see `VALIDATION_REPORT.md`). Covers every extraction adapter that exists in the codebase today. As new adapters ship (Roadmap v0.2: Reservation Statistics, Open Balance, Reservation Statistics 1), this document must be updated in the same change — an undocumented parser is not considered complete (Constitution, Definition of Done).

## Manager Flash Adapter

**Location**: `src/server/modules/report-extraction/adapters/manager-flash.ts`
**Report type**: `MANAGER_FLASH`
**Status**: implemented, **accuracy unvalidated against real Opera exports** (see Validation Report — no real sample was available at time of writing).

### Supported Layouts

None yet *confirmed* against a real export. The adapter is built to a generic, plausible Opera Manager Flash layout: a single-page or multi-page text report with `Label: Value` or `Label - Value` pairs, one per line, covering the fields listed below. It has not been run against an actual Opera Cloud Manager Flash PDF.

### Fields the Adapter Attempts to Extract

| Metric key | Label variants matched |
|---|---|
| `occupancy_pct` | "Occ", "Occupancy", "Occ %" |
| `rooms_available` | "Room Avail", "Rooms Available" |
| `rooms_sold` | "Rooms Sold" |
| `out_of_order_rooms` | "Out of Order", "OOO" |
| `arrivals` | "Arrivals" |
| `departures` | "Departures" |
| `stayovers` | "Stay Overs", "Stayovers" |
| `no_shows` | "No Shows", "No-Shows" |
| `cancellations` | "Cancellations", "Cancelations" |
| `room_revenue` | "Room Revenue" |
| `total_revenue` | "Total Revenue" |
| `adr` | "ADR", "Average Daily Rate" |
| `revpar` | "RevPAR" |
| `complimentary_rooms` | "Comp Rooms", "Complimentary Rooms" |
| `house_use_rooms` | "House Use" |
| `adults` | "Adults" |
| `children` | "Child", "Children" |
| `total_guests` | "Total Guests", "Guest Count" |

**Not attempted by this adapter** (fall through as `missing` even on a Manager Flash report): `open_balance`, `cash`, `card`, `city_ledger` — these are Open Balance report fields (v0.2 adapter, Roadmap D22), not typically present on a Manager Flash export; if a hotel's Manager Flash layout does include them, they will not be captured until that assumption is revisited.

### Known Assumptions

1. **Label-before-value, same line**: the regex pattern is `label\s*[:\-]?\s*number`. A layout where the value appears on the line *after* the label (common in some table-rendered PDFs where the PDF.js text layer linearizes columns unpredictably) will not match.
2. **Decimal/thousands format**: numbers are parsed as `[\d,]+(?:\.\d+)?` — comma as thousands separator, period as decimal separator (e.g., `1,234.56`). A layout using comma as the decimal separator (common in some European/Arabic-locale exports) would be misparsed.
3. **Date format**: a `DD/MM/YYYY`-or-`MM/DD/YYYY`-shaped date is searched for anywhere in the text. When day/month order is ambiguous (both values ≤ 12), the parser deliberately returns no date rather than guessing — see `parseLooseDate` in the adapter file. This means many valid dates will require manual entry, by design.
4. **Report-type detection**: primarily relies on finding the literal string "Manager's Flash" (or "Manager Flash") in the text; falls back to a weaker heuristic (fraction of known field labels found) if that marker is absent.
5. **No table/column structure awareness**: `unpdf`'s text extraction linearizes the PDF's text content; if the real Manager Flash layout uses a multi-column table (e.g., "Today | MTD | YTD" side by side), the adapter has no way to distinguish which column a matched number came from — it will grab whichever number appears first after the label, which may be the wrong column.

### Failure Modes

- **Silent under-extraction**: a field whose label wording doesn't match any of the variants above returns `missing` — never a wrong guess, but the user must catch this via the Data Quality completeness score and manually enter the value.
- **Wrong-column extraction** (see assumption 5): if a report has "Today" and "MTD" columns, the parser may extract the MTD figure believing it's today's — this is the single highest-risk known failure mode and cannot be ruled out without a real sample to test against.
- **False "ambiguous" flags**: if a label legitimately appears twice in a report with two different values for unrelated reasons (e.g., appears in both a summary section and a detail section), the adapter will flag it `ambiguous` even though there's no real conflict — a false positive on the ambiguity check, safer than silently picking one.
- **Date detection false negative**: any date format other than `D/M/Y` variants (e.g., "15 July 2026" or "2026-07-15") will not be found at all, requiring full manual date entry.

### Future Improvements

1. Obtain a real Manager Flash sample (ideally several, across different Opera Cloud versions/regions) and calibrate every label pattern and the date parser against it — see Validation Report "Recommended Next Improvements."
2. Add column-awareness if real exports turn out to be table-structured (would likely require switching to a position-aware text extraction approach (PDF.js exposes per-character coordinates; unpdf's default extractText() does not use them)).
3. Support additional date formats once real samples show what's actually used.
4. Add locale-aware number parsing if real exports use comma-decimal formatting.

## Generic Fallback Adapter

**Location**: `src/server/modules/report-extraction/adapters/generic-fallback.ts`
**Report type**: `GENERIC`
**Status**: implemented, by design does no structured extraction.

### Supported Layouts

All PDFs are "supported" in the sense that this adapter never fails — it always matches (at minimal confidence, `0.05`) as the fallback when no type-specific adapter scores higher.

### Unsupported Layouts

Every layout, structurally — this adapter extracts zero fields on purpose. Raw text is stored (`ReportDocument.rawExtractedText`) for reference and future manual entry or future adapter development, but no metric values are ever populated automatically.

### Known Assumptions

None — this adapter makes no structural assumptions about the input, which is exactly why it makes no claims about it either.

### Failure Modes

Not applicable in the usual sense — its only "failure" would be if it were ever mistakenly selected over a real adapter for a report that *should* have matched (i.e., a Manager Flash detection bug), which would silently degrade a parseable report to manual-entry-only. This is mitigated by `selectAdapter`'s scoring: the generic fallback's fixed `0.05` score is low enough that any real signal from the Manager Flash adapter's `detect()` wins.

### Future Improvements

Not applicable — this adapter is intentionally minimal. It is superseded, per report type, as dedicated adapters (Reservation Statistics, Open Balance, Reservation Statistics 1) ship in v0.2.

## Adapter Selection (`selectAdapter`)

**Location**: `src/server/modules/report-extraction/adapters/index.ts`

Picks whichever registered adapter's `detect()` returns the highest confidence score, defaulting to the generic fallback if no adapter scores higher than its `0.05` baseline. This is a simple highest-score-wins selection with no tie-breaking logic beyond array order — with only one real adapter registered in v0.1, this has not been exercised against a genuine ambiguous-type scenario.
