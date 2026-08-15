# Architecture

## Intent

Health Quest is local-first. The browser application is useful without a network after installation, and no account or remote API is required. Current code is an implementation of today's decisions, not an instruction to preserve them forever.

## Boundaries

- `src/domain` contains portable records and deterministic scheduling, completion, XP, streak, and achievement policies.
- `src/application` defines persistence contracts and application defaults.
- `src/infrastructure` implements IndexedDB and encrypted backup adapters.
- `src/ui/views` renders each screen as a view from application state; it owns no persistence or navigation side effects.
- `src/ui/app.ts` coordinates navigation, event handlers, persistence, backups, and theme application.
- `tools` contains the separate, temporary LAN ciphertext-transfer utility.

Domain code does not depend on the DOM, IndexedDB, Vite, or the transfer server. Storage can therefore be replaced without rewriting reward rules, while game rules can change without migrating mutable XP totals.

## Data flow

Routines reference exercise definitions. The first time a scheduled date is opened, the app snapshots applicable routines and prescriptions into a daily session. Completion changes only that session. Progress is derived from the complete session history.

IndexedDB holds one versioned application document. Imports decrypt and validate a full replacement before asking for confirmation and writing it, preventing partially restored state.

The optional Supabase adapter uploads the same encrypted replacement envelope into a Postgres row
owned by the authenticated user. IndexedDB remains authoritative and offline-capable. Supabase Auth
persists its browser session, while backup passwords exist only in memory. After a successful manual
cloud backup, changes schedule further encrypted snapshots for the remainder of that open session.
Restore remains an explicit full replacement rather than unsafe last-write-wins synchronization.

## PWA lifecycle

Vite creates fingerprinted static assets. A small service worker fetches navigations from the network first so newly deployed HTML cannot reference assets removed by a later deployment, while retaining the last successful shell as its offline fallback. Other successful GET responses are cached for offline use. GitHub Pages hosts only those assets; browser databases and backups are not deployed.

## Dependencies

| Package                 | Purpose                                                                  | Removal path                                        |
| ----------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `qrcode`                | Correct QR encoding for LAN pairing                                      | Replace the terminal QR with a manually entered URL |
| `@supabase/supabase-js` | Account authentication and encrypted snapshot persistence                | Retain local and file backups only                  |
| `vite`                  | Development server and static build                                      | Use `tsc` plus a custom static build script         |
| `typescript`            | Static checking                                                          | Convert sources to browser JavaScript               |
| `vitest`                | Readable unit and adapter tests                                          | Use Node's test runner after compiling tests        |
| `playwright`            | Critical real-browser journey                                            | Maintain a documented manual acceptance script      |
| `fake-indexeddb`        | IndexedDB adapter tests in Node                                          | Test only through Playwright                        |
| `tsx`                   | Run the TypeScript LAN tool                                              | Compile the tool before execution                   |
| `prettier`              | Consistent formatting across code, CSS, configuration, and documentation | Apply equivalent editor formatting rules manually   |

Versions are pinned in `package.json` and the lockfile.
