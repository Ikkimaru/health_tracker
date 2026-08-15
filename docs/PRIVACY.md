# Privacy, backups, and local transfer

Personal records live in the browser's IndexedDB database. GitHub Pages receives normal static-file requests but no health records, analytics events, account details, or backup passwords. Different browser profiles and devices have independent databases.

## Backup security

Backups use AES-256-GCM. Their keys are derived from the user-entered password with PBKDF2-HMAC-SHA-256, a random 16-byte salt, and 310,000 iterations. Each backup has a random 12-byte IV. The JSON envelope exposes only format metadata, encryption parameters, creation time, and ciphertext.

The password is never saved and cannot be recovered. Import authenticates, decrypts, parses, and validates a backup before offering replacement. Keep separate backups before replacing important data.

## Optional Supabase backup

When configured and explicitly used, the app stores application data in normalized Supabase
snapshot tables. Supabase can process readable health records plus account email, identifiers,
timestamps, sizes, authentication, and network metadata. Row Level Security restricts each signed-in user to their own records. The
public browser key is not a secret and grants no bypass of those policies; a service-role key must
never be included in the app. Supabase Auth persists its session in browser storage.

Accounts with the Developer role can view the email address, registration date, and application role
of every registered account. This directory is returned by a server-authorized database function;
ordinary users cannot query it. Developers do not receive access to another user's health snapshots.

Database constraints reject documents larger than 5 MB, and a database trigger retains
only the current and immediately previous successful snapshots per account. These limits are enforced even when a caller bypasses
the application interface and sends requests directly to the Data API.

Cloud restore validates and decrypts the newest snapshot before asking to replace local data. The
feature is backup and recovery, not conflict-aware synchronization between simultaneously edited
devices.

Refresh reconciliation compares a SHA-256 fingerprint of the local application document with the
latest Supabase snapshot. Per-account synchronization IDs, fingerprints, and timestamps are stored
in browser local storage; the fingerprint is not a copy of the underlying health records. Conflicts
require the user to choose which complete version replaces the other.

The first cloud backup transfers the complete application document. Later backups send only changed
entities and dated weight upserts or deletions. Supabase merges the patch transactionally; transport
payloads therefore do not repeatedly include unchanged health history. Local changes are immediate;
automatic cloud transport waits for a one-minute quiet period and coalesces edits made during that
period.

## QR LAN transfer

The QR contains an HTTP address on the computer's LAN, the selected direction, and a random 192-bit token. It does not contain health data or a password. The temporary server:

- transfers only encrypted backup envelopes;
- accepts a single operation before closing;
- expires after ten minutes;
- rejects files over 25 MB and files without the expected format;
- never decrypts the backup; and
- saves received files under ignored `.local/transfers`.

HTTP is deliberately limited to ciphertext on a user-selected local network. Someone who captures the file can attempt offline password guesses, so use a long unique backup password. Do not use the transfer utility on an untrusted network.

## Private local files

Gitignore prevents accidental Git inclusion; it is not encryption. Ignored files remain visible to local users, administrators, malware, and backup software. Credentials belong in an operating-system credential store, not agent instructions. If a secret is committed, remove it from history and rotate it; a later deletion commit is insufficient.
