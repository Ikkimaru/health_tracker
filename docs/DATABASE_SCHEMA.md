# Database schema

## Purpose

This is the authoritative map of Health Quest persistence. Update it in the same change as any
table, object store, column, relationship, or migration change.

## Supabase

Supabase stores up to five restorable application snapshots per account. A snapshot is one atomic
version of the user's data, but its feature records are normalized instead of being embedded in a
single JSON document. `store_app_snapshot` writes a complete snapshot, and
`download_latest_app_snapshot` reconstructs the application document expected by the browser.

All user-owned tables use Row Level Security. Authenticated browser clients can directly list and
delete only their own snapshot metadata; feature-table access is confined to narrowly granted
database functions that validate the authenticated owner. Deleting an authentication user deletes
their snapshots. Deleting a snapshot cascades through every record belonging to that snapshot.

| Table                    | Purpose                                                  | Important columns                                                                                 |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `app_snapshots`          | Snapshot identity, owner, version, and retention order   | `id`, `user_id`, `schema_version`, `created_at`                                                   |
| `app_settings`           | One settings record per snapshot                         | `snapshot_id`, `user_id`, `display_name`, `theme`, `custom_theme`                                 |
| `exercises`              | Exercise definitions in a snapshot                       | `snapshot_id`, `id`, `position`, `name`, `measurement_kind`, prescription defaults, archive state |
| `routines`               | Routine definitions in a snapshot                        | `snapshot_id`, `id`, `position`, `name`, archive state                                            |
| `routine_items`          | Ordered exercise configuration inside a routine          | `snapshot_id`, `routine_id`, `id`, `position`, `exercise_id`, overrides                           |
| `routine_weekdays`       | Ordered recurring weekdays for a routine                 | `snapshot_id`, `routine_id`, `position`, `weekday`                                                |
| `routine_dates`          | Ordered explicit dates for a routine                     | `snapshot_id`, `routine_id`, `position`, `scheduled_date`                                         |
| `daily_sessions`         | Immutable scheduled-day snapshots and completion history | `snapshot_id`, `id`, `position`, `session_date`, `created_at`                                     |
| `daily_session_routines` | Ordered routines captured by a daily session             | `snapshot_id`, `session_id`, `position`, `routine_id`                                             |
| `session_exercises`      | Ordered exercise snapshots within a daily session        | `snapshot_id`, `session_id`, `id`, `source_exercise_id`, completion fields                        |
| `session_prescriptions`  | Ordered set-level targets and completion                 | `snapshot_id`, `session_id`, `session_exercise_id`, `id`, `target`, `completed`                   |

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
same snapshot, preventing cross-version links. `position` preserves application array order.

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

| Database                   | Object store | Key       | Value                                        |
| -------------------------- | ------------ | --------- | -------------------------------------------- |
| `health-quest` (version 1) | `app-data`   | `current` | Complete schema-version-1 `AppData` document |

The browser store intentionally remains a single document because local saves and full replacement
imports are atomic at this boundary. The feature tables above apply to the relational Supabase
backup boundary.
