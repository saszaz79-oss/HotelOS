# HotelOS Engineering Validation Report

**Date**: 2026-07-18 (initial version, produced at the start of the Validation Phase — see `ROADMAP.md`)
**Author**: Engineering (Claude Code session), reviewed against Product Owner's Validation Phase directive.
**Status**: Phase 0 of validation — infrastructure complete, **zero real Opera reports have been processed through the system**. Every figure in this report reflects that.

This report exists to answer one question honestly: *is HotelOS's extraction/normalization/Health Score/Decision Engine pipeline reliable enough to build further business modules on top of?* Per the Product Principle ("never hide uncertainty"), the honest current answer is: **unknown — not yet measured against real data.** This document exists precisely to make that gap visible rather than papering over it, and to define what "measured" will look like once real reports are available.

## 1. Current Accuracy

**Unmeasured.** No real Opera Cloud Manager Flash export (or any other report type) has been run through the extraction pipeline in this environment — every test performed during development used synthetic text constructed to resemble a plausible Manager Flash layout (see the pure-function tests described in session history; not persisted as an automated test suite yet — see §6 below).

What *has* been verified (synthetic, not real-data):
- The label/value regex extraction correctly parses well-formed `Label: Value` lines when the synthetic text matches the assumed layout.
- The date parser correctly resolves unambiguous `DD/MM/YYYY`-style dates and correctly refuses to guess ambiguous ones (verified with a real bug catch and fix during development — see `DECISIONS.md`-adjacent session history: an initial version silently misparsed `15/07/2026` as an overflowing month before the day/month disambiguation logic was added).
- The Data Quality Engine's completeness/confidence scoring and the deterministic Decision Engine rules (occupancy risk/opportunity, open balance risk, low-completeness alert) all produce the expected classifications against constructed inputs.

None of this constitutes measured accuracy against a real report, because the real failure modes (wrong-column extraction, unexpected label wording, non-standard date formats, table-structured layouts) can only surface against real Opera Cloud output. The infrastructure to measure this the moment real data is available now exists (§5, "Real Data Mode").

## 2. Known Limitations

- **Only Manager Flash has a real adapter.** Reservation Statistics, Open Balance, and Reservation Statistics 1 route through the generic fallback (zero structured extraction) — this is a deliberate v0.1 scope decision (`DECISIONS.md` D22), not a defect, but it means those report types currently provide no automated value beyond raw-text storage.
- **No table/column awareness.** If Manager Flash reports are laid out with side-by-side columns (e.g., Today/MTD/YTD), the current line-based regex approach cannot reliably distinguish which column a number came from — see `PARSER_DOCUMENTATION.md` for detail. This is the single highest-risk known limitation.
- **Date detection is deliberately conservative.** Ambiguous dates (both day and month ≤ 12) are never guessed, which is correct behavior per the Product Principle, but means a non-trivial fraction of real reports will require manual date entry even when the source date is unambiguous to a human reader (a human resolves "05/07" using report context — the parser does not attempt that).
- **No duplicate-attempt volume tracking.** Exact-duplicate uploads are rejected in-line (Roadmap M2) but the rejection itself is not persisted anywhere queryable — the Data Quality Dashboard cannot yet show "N duplicate upload attempts this month."
- **"Unknown fields" has no data by construction.** The Manager Flash adapter only ever emits the canonical metric keys it was built to look for — it cannot currently detect and surface a field it wasn't told to look for (e.g., an unfamiliar line item on a real report). This means the Dashboard's "Unknown Fields" category, per the Validation Phase requirement, is currently structurally empty, not because there are no unknown fields in real reports, but because the parser has no mechanism to notice them.
- **AI Executive Summary requires a configured provider.** In this development environment, `ANTHROPIC_API_KEY` is unset, so the Executive AI Summary path returns a "not configured" state rather than real output — the code path is real and was verified to fail closed (see `ai-orchestration/providers/anthropic.ts`), but has never produced a real model response in this environment.

## 3. Unsupported Cases

- Report types other than Manager Flash (structured extraction).
- Any Manager Flash layout using table/column structure, non-`DD/MM/YYYY`-family dates, or comma-as-decimal-separator numbers (see `PARSER_DOCUMENTATION.md` §Known Assumptions).
- Multi-hotel / batch report uploads in a single file (v0.1 assumes one report per PDF).
- Scanned/image-only PDFs (no OCR — `pdf-parse` extracts embedded text only; a scanned report with no text layer will yield empty extraction with no specific error explaining why, beyond a low-field-count generic-fallback selection).

## 4. Parser Confidence

The Manager Flash adapter's own confidence scores are deliberately conservative by construction (see `types.ts` — nothing is `verified` from automatic extraction alone; everything lands as `needs_review` or `ambiguous` until a human confirms it). This is a design choice, not a measured calibration — the confidence number reflects "a deterministic pattern matched" (0.6 baseline, 0.25 if outside a plausible range), not any measured correlation with actual correctness, because no ground-truth comparison has been run yet to calibrate it against.

## 5. Real Data Mode — Infrastructure Status

Built, per the Validation Phase directive, and ready to use the moment real Opera exports are available:
- `ExtractionGroundTruth` model (`prisma/schema.prisma`) — records engineer-entered expected values per report.
- `recordGroundTruth` / `compareExtractionAccuracy` (`src/server/modules/validation/commands.ts`) — computes match/mismatch/false-positive/false-negative classification per field and an overall accuracy percentage.
- Ground-truth entry form and accuracy report display, wired into the Validation Workspace at `/validation/[reportDocumentId]`.

**Not yet exercised**: zero `ExtractionGroundTruth` rows exist. The moment a real Manager Flash PDF and its correct expected values are available, an engineer should: upload it through the normal flow, open it in the Validation Workspace, enter the true values from the source PDF, and read the resulting accuracy report — at that point this section of the document must be rewritten with real numbers, false-positive/false-negative examples, and a concrete accuracy percentage.

## 6. Remaining Risks

1. **No automated regression test suite** for the extraction adapters, scoring, or Decision Engine rules — verification so far has been manual/scratch-script during development (see session history), not a checked-in, CI-enforced test suite. A future adapter change could silently regress behavior with nothing catching it.
2. **Single-sample risk**: even once real ground truth exists for one or two reports, that is not statistically representative of accuracy across a hotel's full report history or across different hotels' Opera configurations.
3. **Wrong-column extraction is undetectable by the current confidence model** — a wrong-column match looks identical (same confidence score) to a correct match, since the regex has no way to know it grabbed the wrong number. This is the limitation most likely to produce a confidently-wrong value that a rushed reviewer might not catch.
4. **AI Executive Summary is unvalidated end-to-end** — the grounding/validation logic has been reviewed and the "provider not configured" failure path verified, but no real model call has been observed, so behavior against a real Anthropic response (e.g., whether the heuristic hallucination check has false positives/negatives) is unknown.

## 7. Recommended Next Improvements (Priority Order)

1. **Obtain 3-5 real Manager Flash PDFs** (ideally from different hotels/properties to catch layout variance) and run them through Real Data Mode — this is the single highest-value next step and unblocks every other accuracy claim in this document.
2. **Add a checked-in automated test suite** for the extraction adapters and Decision Engine rules using the real (or realistic, if real samples can't be committed to source control for confidentiality reasons) samples obtained in step 1, so regressions are caught automatically going forward.
3. **Investigate table/column structure** in real exports; if present, evaluate switching from `pdf-parse`'s `getText()` to its `getTable()` API for the affected fields.
4. **Configure a real `ANTHROPIC_API_KEY`** in a test environment and validate the Executive AI Summary end-to-end against real metrics, specifically probing the hallucination-check heuristic with adversarial cases.
5. **Persist rejected-duplicate-upload events** so the Data Quality Dashboard's "Duplicate Detection" section has real data instead of the current documented gap.

## Quality Gate Statement

Per Product Owner direction, no new AI modules, business modules, or advanced features should proceed until this report shows the pipeline is reliable on real operational data. **This version of the report does not yet demonstrate that** — it demonstrates that the pipeline and its own validation tooling are built and internally consistent, and defines exactly what evidence is needed next (§7, item 1) to actually clear the gate. This report should be revised, with real numbers, once that evidence exists.
