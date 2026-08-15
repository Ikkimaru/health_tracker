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

IndexedDB holds one versioned application document. Imports decrypt and validate a full replacement before asking for confirmation and writing it, preventing partially restored state. The complete browser and Supabase layouts are recorded in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

The optional Supabase adapter sends a full document for the initial snapshot, then sends entity-level
patches containing only changed settings, exercises, routines, sessions, or weight dates. A
transactional database function serializes each user's patches, merges them into the current
document, and expands the result into feature-specific Postgres tables. Snapshot metadata ties those
rows into restorable versions and preserves the current and immediately previous successful cloud snapshots. IndexedDB
remains authoritative and offline-capable, with five rotating pre-save recovery points stored in a
separate local object store.
Supabase Auth persists its browser session. Signed-in changes save to IndexedDB immediately and
reset a one-minute quiet-period timer before a cloud snapshot is attempted, coalescing rapid local
edits rather than interacting with Supabase for each change.
Restore remains an explicit full replacement rather than unsafe last-write-wins synchronization.

On browser refresh, a signed-in client checks Supabase at most once per minute. A local fingerprint
and cloud snapshot ID record the last common version. If only one side changed, that side wins; if
both changed, the user chooses which full version to keep. The selected local version is uploaded as
a new snapshot, while the selected cloud version atomically replaces IndexedDB. Conflict resolution
can be cancelled without changing either version.

## PWA lifecycle

Vite creates fingerprinted static assets. A small service worker fetches navigations from the network first so newly deployed HTML cannot reference assets removed by a later deployment, while retaining the last successful shell as its offline fallback. Other successful GET responses are cached for offline use. GitHub Pages hosts only those assets; browser databases and backups are not deployed.

## Dependencies

| Package                 | Purpose                                                                  | Removal path                                        |
| ----------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `qrcode`                | Correct QR encoding for LAN pairing                                      | Replace the terminal QR with a manually entered URL |
| `@supabase/supabase-js` | Account authentication and snapshot persistence                          | Retain local and file backups only                  |
| `vite`                  | Development server and static build                                      | Use `tsc` plus a custom static build script         |
| `typescript`            | Static checking                                                          | Convert sources to browser JavaScript               |
| `vitest`                | Readable unit and adapter tests                                          | Use Node's test runner after compiling tests        |
| `playwright`            | Critical real-browser journey                                            | Maintain a documented manual acceptance script      |
| `fake-indexeddb`        | IndexedDB adapter tests in Node                                          | Test only through Playwright                        |
| `tsx`                   | Run the TypeScript LAN tool                                              | Compile the tool before execution                   |
| `prettier`              | Consistent formatting across code, CSS, configuration, and documentation | Apply equivalent editor formatting rules manually   |

Versions are pinned in `package.json` and the lockfile.
