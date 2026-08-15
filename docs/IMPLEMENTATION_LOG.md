# Implementation log

## Weight tracking

- Added same-day capture on Today and a dedicated Weight view with historical date editing, calendar history, range-filtered line charts, and a dotted selectable trend.
- Added goal weight, deadline, and three forecast methods to Settings. Forecasts are descriptive mathematical extrapolations with an explicit health disclaimer.
- Stored cloud weight readings as constrained one-date-per-row records rather than monthly JSON; older local and cloud snapshots restore with empty weight history and default linear forecasting.
- Made calendar dates the historical add/edit control and added a Monday-or-Sunday week-start preference.
- Strengthened the modal overlay and scroll lock, added week-start date labels to the chart, and added range-aware daily, weekly, and monthly dot aggregation.
- Anchored finite chart ranges to today, limited the trend line to observed-and-future time, and reserved dense day-number labels for the one-month daily view.
- Added weight labels to chart points and selectable horizontal-and-vertical crosshairs for visual comparisons.
- Added explicit previous/next month calendar navigation and confirmed deletion for existing weight records.
- Hid the Today weight-entry card after that day's reading has been captured; later edits remain in the calendar.

## 2026-08-15 — Registration date format

- Standardized developer-directory registration dates as `yyyy-mm-dd`.

## 2026-08-15 — Registered-user RPC fix

- Qualified role-table columns in the developer directory function to prevent PostgreSQL output-column ambiguity.

## 2026-08-15 — Precise sync cooldown

- Changed refresh cooldown feedback from rounded minutes to the exact remaining seconds.

## 2026-08-15 — Cancellable sync conflicts

- Added Local, Supabase, and Cancel outcomes when refresh reconciliation detects changes on both sides.
- Added visible remaining-wait feedback when a refresh occurs during the one-minute cooldown.

## 2026-08-15 — Refresh reconciliation

- Added once-per-minute refresh reconciliation using the last common local fingerprint and Supabase snapshot ID.
- Automatically restores or uploads when only one side changed and prompts when both sides changed.
- Added latest backup and query timestamps to Settings and a one-minute restore cooldown.

## 2026-08-15 — Settings card spacing

- Added consistent vertical spacing between static and dynamically inserted Settings panels.

## 2026-08-15 — User and developer roles

- Added server-authorized User and Developer roles, defaulting every account to User.
- Added a developer-only Settings view of registered account emails, roles, and registration dates without exposing other users' health data.

## 2026-08-15 — Viewport snackbar feedback

- Replaced page-top action notices with an accessible, viewport-fixed snackbar above the bottom navigation that dismisses after five seconds.
- Added browser coverage confirming theme and encrypted-backup feedback stays visible while Settings is scrolled.

## 2026-08-15 — Initial exercise-tracker implementation

- Added a vanilla TypeScript PWA to provide one installable Android and desktop-browser application without a UI framework.
- Separated domain policies, storage contracts, browser adapters, UI, and LAN tooling so scheduling and reward rules remain replaceable.
- Added exercises, recurring and dated routines, daily snapshots, per-set completion, history, fixed XP/levels, streaks, achievements, themes, and archiving.
- Added IndexedDB persistence and authenticated encrypted replacement backups to keep health data device-local.
- Added a one-use QR LAN utility that transfers ciphertext only and expires after ten minutes.
- Added behavior-focused unit, adapter, security, ignore-policy, and browser journey tests.
- Added offline assets and GitHub Pages deployment configuration.
- Added architecture, domain, privacy, testing, decisions, roadmap, and operating documentation.
- Kept private agent configuration local and ignored. Its contents are intentionally not recorded here.

Verification completed on the implementation environment:

- `npm test`: 14 focused tests passed across five files.
- `npm run build`: TypeScript checking and the production PWA build passed.
- `npm run test:e2e`: the Chromium critical journey passed.
- `npm audit --audit-level=low`: zero known vulnerabilities.
- `git diff --check`: passed; Git reported only the expected Windows line-ending notice.
- `git check-ignore -v AGENTS.md`: confirmed the operative private instructions are ignored.

Physical Android installation, offline relaunch, firewall behavior, and cross-device QR transfer still require the owner's phone and network for manual acceptance testing.

## 2026-08-16 — Normalized Supabase snapshots

- Replaced the catch-all `app_backups` JSON rows with snapshot metadata and feature-specific tables
  for settings, exercises, routines, schedules, daily sessions, and set completion.
- Added atomic database functions that split uploads across those tables and reconstruct complete
  application documents for restore.
- Migrated every existing `app_backups` snapshot before removing the old table, preserving its
  creation time and retention history.
- Removed the superseded `encrypted_backups` table and its unused retention function.
- Kept achievements, XP, levels, and streaks derived from session history to avoid mutable progress
  drift.
- Added an authoritative database-schema reference covering tables, relationships, ownership, and
  the browser IndexedDB layout.

## 2026-08-15 — Formatting policy

- Added pinned Prettier tooling and repository configuration to keep TypeScript, CSS, HTML, JSON, YAML, and Markdown readable and consistent.
- Added format and format-check commands, with formatting verification in the Pages workflow.
- Added a private agent rule requiring formatting after changes and before handoff.

## 2026-08-15 — Custom theme editor

- Replaced the browser-dependent theme dropdown with explicit System, Light, Dark, and Custom choices.
- Added controls for every application color token and an isolated live preview containing representative text, surfaces, controls, progress, success, and notice states.
- Kept unsaved edits inside the preview and persisted the selected palette only when the user saves it.
- Added deterministic theme resolution tests and compatibility defaults for existing local databases and backups.

## 2026-08-15 — UI view separation

- Added a dedicated view-rendering module for Today, Exercises, Routines, History, Achievements, and Settings.
- Changed the application coordinator to select views through a single renderer boundary, keeping screen markup separate from stateful event and persistence logic.
- Re-ran formatting, unit tests, production build, and both browser journeys successfully.
