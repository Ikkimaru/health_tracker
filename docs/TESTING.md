# Testing philosophy

Tests protect behavior that is costly or unsafe to verify by inspection. Names should read as user or domain expectations. Do not add tests for trivial field access, library internals, or to raise a coverage number.

- Domain specifications cover scheduling, immutable snapshots, required completion, idempotent derived XP, streaks, achievements, and corrections.
- Adapter tests cover IndexedDB persistence and complete replacement.
- Security tests cover encryption round trips, wrong passwords, malformed envelopes, and transfer validation.
- One Playwright journey checks exercise creation, scheduling, persistence, completion, and progression in a real browser.
- Physical-device acceptance checks cover installation, offline relaunch, and LAN transfer because emulation cannot establish the real network/firewall behavior.

Run `npm run format:check`, `npm test`, `npm run build`, and `npm run test:e2e`. Review failures as behavior regressions rather than weakening assertions to make them pass.
