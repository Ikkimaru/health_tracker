# Architecture

## Intent

Health Quest is local-first. The browser application is useful without a network after installation, and no account or remote API is required. Current code is an implementation of today's decisions, not an instruction to preserve them forever.

## Boundaries

- `src/domain` contains portable records and deterministic scheduling, completion, XP, streak, and achievement policies.
- `src/application` defines persistence contracts and application defaults.
- `src/infrastructure` implements IndexedDB and encrypted backup adapters.
- `src/ui` renders semantic DOM and coordinates user actions.
- `tools` contains the separate, temporary LAN ciphertext-transfer utility.

Domain code does not depend on the DOM, IndexedDB, Vite, or the transfer server. Storage can therefore be replaced without rewriting reward rules, while game rules can change without migrating mutable XP totals.

## Data flow

Routines reference exercise definitions. The first time a scheduled date is opened, the app snapshots applicable routines and prescriptions into a daily session. Completion changes only that session. Progress is derived from the complete session history.

IndexedDB holds one versioned application document. Imports decrypt and validate a full replacement before asking for confirmation and writing it, preventing partially restored state.

## PWA lifecycle

Vite creates fingerprinted static assets. A small service worker caches the application shell and successful GET responses. GitHub Pages hosts only those assets; browser databases and backups are not deployed.

## Dependencies

| Package          | Purpose                                                                  | Removal path                                        |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `qrcode`         | Correct QR encoding for LAN pairing                                      | Replace the terminal QR with a manually entered URL |
| `vite`           | Development server and static build                                      | Use `tsc` plus a custom static build script         |
| `typescript`     | Static checking                                                          | Convert sources to browser JavaScript               |
| `vitest`         | Readable unit and adapter tests                                          | Use Node's test runner after compiling tests        |
| `playwright`     | Critical real-browser journey                                            | Maintain a documented manual acceptance script      |
| `fake-indexeddb` | IndexedDB adapter tests in Node                                          | Test only through Playwright                        |
| `tsx`            | Run the TypeScript LAN tool                                              | Compile the tool before execution                   |
| `prettier`       | Consistent formatting across code, CSS, configuration, and documentation | Apply equivalent editor formatting rules manually   |

Versions are pinned in `package.json` and the lockfile.
