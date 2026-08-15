# Decision records

Decisions document why an approach was selected and make replacement explicit. Each record has a status of `proposed`, `accepted`, or `superseded`. Superseding a record is preferred over silently treating current code as permanent intent.

## Accepted decisions

| Decision                                      | Status   | Reason                                                                   |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| Vanilla TypeScript PWA                        | accepted | One offline-capable Android/browser codebase with few dependencies       |
| IndexedDB document store                      | accepted | Browser-native local persistence with versioned replacement backups      |
| Derived progression                           | accepted | Avoids mutable XP drift and makes historical corrections deterministic   |
| Encrypted replacement backups                 | accepted | Simple, inspectable device transfer without merge ambiguity              |
| One-use LAN QR utility                        | accepted | Convenient local transfer without storing data in a cloud service        |
| Optional Supabase snapshots                   | accepted | RLS-isolated account recovery without making cloud storage authoritative |
| Private agent configuration excluded from Git | accepted | Repository clones must not receive owner-specific instructions           |
