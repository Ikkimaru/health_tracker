# Database schema

## Purpose

This is the authoritative map of Health Quest persistence. Update it in the same change as any
table, object store, column, relationship, or migration change.

## Supabase

Supabase stores the current and immediately previous successful application snapshots per account. A snapshot is one atomic
version of the user's data, but its feature records are normalized instead of being embedded in a
single JSON document. `store_app_snapshot` writes a complete snapshot, and
`download_latest_app_snapshot` reconstructs the application document expected by the browser.
After the initial snapshot, `store_app_patch` accepts only changed entities or weight dates. It locks
patch application per user, merges those changes with the current document inside the database, and
calls the same normalized snapshot writer atomically. This minimizes network transfer while keeping
complete current and previous versions available for restore.

All user-owned tables use Row Level Security. Authenticated browser clients can directly list and
delete only their own snapshot metadata; feature-table access is confined to narrowly granted
database functions that validate the authenticated owner. Deleting an authentication user deletes
their snapshots. Deleting a snapshot cascades through every record belonging to that snapshot.
Application roles are separate from health snapshots. Accounts without an `app_user_roles` row are
ordinary users. Restricted database functions resolve the current role and expose the authentication
user directory only to developers.

| Table                    | Purpose                                                  | Important columns                                                                                 |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `app_snapshots`          | Snapshot identity, owner, version, and retention order   | `id`, `user_id`, `schema_version`, `created_at`                                                   |
| `app_settings`           | One settings record per snapshot                         | `snapshot_id`, `user_id`, display/theme, weight goal/deadline, trend method, calendar week start  |
| `weight_entries`         | One body-weight reading per recorded local date          | `snapshot_id`, `user_id`, `entry_date`, `weight_kg`                                               |
| `exercises`              | Exercise definitions in a snapshot                       | `snapshot_id`, `id`, `position`, `name`, `measurement_kind`, prescription defaults, archive state |
| `routines`               | Routine definitions in a snapshot                        | `snapshot_id`, `id`, `position`, `name`, archive state                                            |
| `routine_items`          | Ordered exercise configuration inside a routine          | `snapshot_id`, `routine_id`, `id`, `position`, `exercise_id`, overrides                           |
| `routine_weekdays`       | Ordered recurring weekdays for a routine                 | `snapshot_id`, `routine_id`, `position`, `weekday`                                                |
| `routine_dates`          | Ordered explicit dates for a routine                     | `snapshot_id`, `routine_id`, `position`, `scheduled_date`                                         |
| `daily_sessions`         | Immutable scheduled-day snapshots and completion history | `snapshot_id`, `id`, `position`, `session_date`, `created_at`                                     |
| `daily_session_routines` | Ordered routines captured by a daily session             | `snapshot_id`, `session_id`, `position`, `routine_id`                                             |
| `session_exercises`      | Ordered exercise snapshots within a daily session        | `snapshot_id`, `session_id`, `id`, `source_exercise_id`, completion fields                        |
| `session_prescriptions`  | Ordered set-level targets and completion                 | `snapshot_id`, `session_id`, `session_exercise_id`, `id`, `target`, `completed`                   |
| `app_user_roles`         | Optional elevated application role per account           | `user_id`, `role`, `created_at`, `updated_at`                                                     |

### Relationships

```text
auth.users
└── app_snapshots
    ├── app_settings
    ├── exercises
    ├── routines
    │   ├── routine_items ──> exercises
    │   ├── routine_weekdays
    │   └── routine_dates
    └── daily_sessions
        ├── daily_session_routines ──> routines
        └── session_exercises ──> exercises
            └── session_prescriptions
```

Every feature relationship includes `snapshot_id`. Records can only reference definitions from the
same snapshot, preventing cross-version links. `position` preserves application array order. The
cross-feature exercise and routine references use deferred `NO ACTION` checks: deleting an entity
from a retained snapshot remains prohibited, while deleting an entire expired snapshot can finish
all of its cascades before PostgreSQL validates that no references remain.

### Derived achievements and progress

Achievements, XP, levels, and streaks do not have tables. They are deterministic projections of
daily sessions, so storing them would duplicate state and risk drift after a historical completion
is corrected. Their definitions and derivation live in `src/domain/rules.ts`.

### Migration from `app_backups`

Migration `20260816090000_normalize_app_snapshots.sql` expands every existing `app_backups.data`
document into the normalized tables while retaining its original creation time. Only after all rows
have been transferred does it remove `app_backups`. Existing backup history is therefore preserved,
not merely the latest row. The unused legacy `encrypted_backups` table is also removed; it is not
migrated because the application superseded that encrypted cloud format before introducing readable
`app_backups` snapshots.

## Browser IndexedDB

IndexedDB remains the authoritative offline store.

| Database                   | Object store      | Key         | Value                                                |
| -------------------------- | ----------------- | ----------- | ---------------------------------------------------- |
| `health-quest` (version 2) | `app-data`        | `current`   | Complete schema-version-1 `AppData` document         |
| `health-quest` (version 2) | `recovery-points` | Recovery ID | Timestamped pre-save `AppData`; newest five retained |

Browser `localStorage` keeps per-account synchronization metadata: the last common snapshot ID and
local fingerprint, plus latest backup, query, and restore timestamps. It contains no health records.

The browser store intentionally remains a single document because local saves and full replacement
imports are atomic at this boundary. The feature tables above apply to the relational Supabase
backup boundary.

IndexedDB version 2 also contains a `recovery-points` object store keyed by recovery ID. Before a
changed current document is saved, its previous value is recorded there with a timestamp. Duplicate
states are skipped and only the newest five are retained. Recovery points never leave the device
unless the user explicitly selects one for Supabase upload.
