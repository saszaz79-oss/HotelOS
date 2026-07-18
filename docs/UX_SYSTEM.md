# HotelOS UX System

## 1. Navigation

**Desktop**: persistent left sidebar (icon + label) — collapses to icon-only on narrower desktop widths. Top bar: hotel switcher (if multi-hotel), language toggle, user menu.
Sidebar items (role-permitting): Mission Control, Comparison Center, Reports (upload/review), Executive Archive, Ask AI, Users & Roles (Admin), Hotel Settings (Admin), Super Admin (Super Admin only).

**Mobile**: bottom navigation bar with 4–5 primary destinations (Mission Control, Reports, Ask AI, Archive, More) — matches Constitution §9 mobile-first requirement. Hotel switcher and secondary items live under "More" / top-bar menu.

**RTL**: sidebar mirrors to the right edge in Arabic; bottom nav order mirrors accordingly; icons that imply direction (back/forward arrows, chevrons) flip — icons that don't imply direction (upload, chart) do not flip.

## 2. Screen Map

1. **Login** — username/password, forgot-password link, language toggle available pre-auth.
2. **Hotel Selector** (shown only if user has >1 hotel membership, otherwise skipped).
3. **Mission Control** (home) — see PRD §6.
4. **Comparison Center** — comparison type selector, results table/cards, drill-in per metric.
5. **Reports → Upload** — drag/select multi-file upload, per-file type/status list.
6. **Reports → Review** — per-report extracted-field review/correction screen with source reference.
7. **Ask AI** — chat interface, per-hotel conversation history sidebar, fact/calculation/recommendation visual distinction in responses.
8. **Executive Archive** — filterable table (mobile: filterable card list) of uploads/analyses/exports.
9. **Export Preview / Generate** — configure period + language, preview, generate, download.
10. **Users & Roles** (Hotel Admin) — member list, invite, role assignment.
11. **Hotel Settings** (Hotel Admin) — profile fields from PRD §3.
12. **Super Admin Console** — hotel list/lifecycle management, cross-hotel user overview, system audit log.
13. **Audit Log Viewer** (Super Admin, Hotel Admin scoped to own hotel).

## 3. Mobile Behavior

- Single-column stacked cards on Mission Control; Health Score card first, then alerts, then key metrics grid (2 columns), then comparison summary, then AI summary, then recent uploads.
- Tables (Archive, Comparison) collapse to card rows on mobile with the same data, reordered by priority rather than horizontally scrolled where avoidable; wide tables that must stay tabular get horizontal scroll with a sticky first column.
- Upload flow uses native file picker / camera-adjacent share-to-app pattern where the PWA shell supports it.
- Bottom nav persists; screen-specific actions surface via a floating action button or top-bar action, never hidden behind ambiguous gestures.

## 4. RTL Rules

- Direction is driven by `dir="rtl"`/`dir="ltr"` at the document root based on `preferredLanguage`, not per-component overrides.
- Use logical CSS properties (`margin-inline-start`, `padding-inline-end`, `text-align: start`) throughout instead of physical `left`/`right`, so mirroring is automatic rather than duplicated per-locale.
- Numerals: hotel metrics display in Western Arabic numerals (0–9) in both languages for consistency and scan-ability across a bilingual team — a documented, deliberate choice (see Decisions doc), not an oversight.
- Charts mirror axis direction in RTL (value growth still reads "up," but time axis flows right-to-left) — verified explicitly in Quality Gates, not assumed to "just work" from `dir="rtl"`.
- Mixed content (e.g., an English hotel name inside an Arabic sentence) uses Unicode bidi isolation (`<bdi>` / `unicode-bidi: isolate`) to prevent punctuation/number reordering bugs.

## 5. Design Tokens

**Color** — executive, calm, hospitality-appropriate (exact hex values finalized during Phase 1 visual design, principles fixed now):
- Neutral-first palette (warm off-white / deep charcoal, not stark black/white) as the dominant surface language.
- A single, restrained accent color (a deep, warm hue consistent with a premium hospitality brand — not generic SaaS blue) used sparingly for primary actions and key data emphasis.
- Semantic colors for status only: success/positive, warning, critical/negative, info — used consistently across health score, alerts, and comparisons so meaning is learned once.
- Minimum WCAG AA contrast for all text/background pairs in both light and (architecturally reserved) dark themes.

**Typography**
- Latin: a humanist sans-serif suited to data-dense UI (e.g., Inter or equivalent) for English.
- Arabic: a professional, screen-optimized Arabic typeface with genuine RTL metrics (e.g., IBM Plex Sans Arabic, Tajawal, or equivalent) — never a Latin font faux-rendering Arabic, never Arabic text squeezed into Latin line-heights.
- Numeric/data typography: tabular figures (fixed-width numerals) for all metric values so numbers in tables/comparisons align vertically.
- Scale: a restrained type scale (roughly 6–7 steps) shared across both languages, with Arabic line-heights tuned slightly taller to accommodate script.

**Spacing**
- 4px/8px base spacing scale; consistent card padding and gap rhythm across Mission Control cards, tables, and forms.

## 6. States

Every data-bearing screen defines all four:
- **Loading**: skeleton loaders matching the eventual content shape (not a generic spinner) for Mission Control cards, tables, and chat responses.
- **Empty**: explains *why* it's empty and what action resolves it (e.g., "No reports uploaded yet for this hotel — upload your first Manager Flash report to see insights here" with a direct upload CTA).
- **Error**: human-readable explanation + retry action; technical detail available via "details" disclosure for support purposes only, never as the primary message.
- **Success**: explicit confirmation (toast/inline) for actions with real consequence (report finalized, export generated, user role changed) — not just a silent state change.

## 7. Accessibility

- WCAG 2.1 AA as the baseline target for contrast, focus visibility, and keyboard navigation.
- All interactive elements reachable and operable via keyboard; focus order follows visual/logical order in both LTR and RTL.
- Form fields (report review corrections especially) have explicit labels, error messages tied via `aria-describedby`, not color-only error indication.
- Charts/health score provide a text-equivalent summary (the factor breakdown itself serves this purpose) so meaning isn't color/shape-only.

## 8. Component Inventory (v0.1)

- App shell: Sidebar nav, Bottom nav, Top bar, Hotel switcher, Language toggle
- Data display: Metric card, Health Score gauge/breakdown, Alert list item, Comparison row/card, Data-completeness badge, Demo-data badge
- Tables: Archive table (+ mobile card variant), Filter bar
- Forms: Text/number/select inputs, File dropzone, Extraction review field (value + confidence + source link + correction input)
- Feedback: Toast, Inline banner (error/warning/info/success), Skeleton loader set, Empty state block
- AI: Chat message bubble (with fact/calculation/recommendation tagging), Chat input, Conversation list item, Citation chip
- Navigation/overlay: Modal/dialog, Confirm-destructive-action dialog, Dropdown menu, Tabs
- Export: Export configuration form, PDF preview frame

This inventory is intentionally scoped to what v0.1 screens require — see `ROADMAP.md` for components deferred to later phases (e.g., advanced chart types, drag-to-reorder dashboards).
