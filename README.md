# Health Quest

<!-- cspell:ignore healthtracker supabase -->

Health Quest is a private, offline-first exercise tracker. It installs as a Progressive Web App on Android, works in desktop browsers, and stores personal data only in that browser profile.

## Start locally

Requirements: Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Open the displayed address. On Android, deploy to HTTPS (such as GitHub Pages), open it in Chrome, and choose **Install app** from the browser menu. After the first successful load, the app works offline.

## Enable Supabase backup

Supabase backup is optional. Without configuration, every local and file-backup feature continues
to work.

1. In Supabase, keep the repository working directory set to `.`. The GitHub integration applies
   migrations from `supabase/migrations` after they reach the configured production branch.
2. In Authentication settings, enable email/password authentication, set the production Site URL,
   and add `http://localhost:5173` as a redirect URL for local development. Choose whether account
   creation requires email confirmation.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` from the project's Connect dialog. These values are intended for
   browsers; never expose a secret or service-role key.
4. Add those two values as GitHub repository variables with the same names. The Pages workflow
   passes them to the production build. Restart the local server or redeploy the app.

In Settings, create an account or sign in, then choose **Back up now**. The newest five snapshots are
retained, and later edits are backed up automatically while the tab remains open. Supabase persists
the authentication session locally. Cloud records are protected by authentication and Row Level
Security but are not encrypted with a separate application password.

### Assign a developer

Every account is a User unless it has an explicit Developer role. After that person has registered,
run the following in the Supabase SQL editor, replacing the email address:

```sql
insert into public.app_user_roles (user_id, role)
select id, 'developer' from auth.users where email = 'developer@example.com'
on conflict (user_id) do update set role = excluded.role, updated_at = now();
```

After signing in again, a Developer section in Settings lists all registered users. Developer access
does not grant access to their health data.

## Verify the application

```powershell
npm test
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests describe business behavior rather than pursuing a coverage percentage. See [Testing](docs/TESTING.md).

Run `npm run format` after editing tracked files. CI rejects inconsistent formatting.

## Move data between devices

1. In Settings, enter a password of at least eight characters and export a `.healthtracker` backup.
2. On the computer, run `npm run transfer`.
3. Choose whether the computer sends or receives, then follow the prompt.
4. Scan the displayed QR code from the phone while both devices are on the same reachable network.
5. Import the received backup through Settings. Import replaces the device's current data after confirmation.

Only an already encrypted backup crosses the LAN. The one-time transfer expires after ten minutes. Guest Wi-Fi isolation and firewall rules can prevent local devices from reaching each other. See [Privacy and backup](docs/PRIVACY.md).

## Git and private agent settings

All Git staging, commits, and pushes are intentionally human-controlled. Project-specific agent configuration is optional, local, and ignored by Git. A fresh clone does not include it. Do not store credentials in agent instruction files.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Domain rules](docs/DOMAIN_RULES.md)
- [Privacy and backup](docs/PRIVACY.md)
- [Testing](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/decisions/README.md)
- [Implementation log](docs/IMPLEMENTATION_LOG.md)
