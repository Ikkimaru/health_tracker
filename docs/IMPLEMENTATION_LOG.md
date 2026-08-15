# Implementation log

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

## 2026-08-15 — Formatting policy

- Added pinned Prettier tooling and repository configuration to keep TypeScript, CSS, HTML, JSON, YAML, and Markdown readable and consistent.
- Added format and format-check commands, with formatting verification in the Pages workflow.
- Added a private agent rule requiring formatting after changes and before handoff.
