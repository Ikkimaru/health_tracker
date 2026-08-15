# Privacy, backups, and local transfer

Personal records live in the browser's IndexedDB database. GitHub Pages receives normal static-file requests but no health records, analytics events, account details, or backup passwords. Different browser profiles and devices have independent databases.

## Backup security

Backups use AES-256-GCM. Their keys are derived from the user-entered password with PBKDF2-HMAC-SHA-256, a random 16-byte salt, and 310,000 iterations. Each backup has a random 12-byte IV. The JSON envelope exposes only format metadata, encryption parameters, creation time, and ciphertext.

The password is never saved and cannot be recovered. Import authenticates, decrypts, parses, and validates a backup before offering replacement. Keep separate backups before replacing important data.

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
