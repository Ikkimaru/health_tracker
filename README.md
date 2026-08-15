# Health Quest

Health Quest is a private, offline-first exercise tracker. It installs as a Progressive Web App on Android, works in desktop browsers, and stores personal data only in that browser profile.

## Start locally

Requirements: Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Open the displayed address. On Android, deploy to HTTPS (such as GitHub Pages), open it in Chrome, and choose **Install app** from the browser menu. After the first successful load, the app works offline.

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
- [Domain rules](docs/DOMAIN_RULES.md)
- [Privacy and backup](docs/PRIVACY.md)
- [Testing](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/decisions/README.md)
- [Implementation log](docs/IMPLEMENTATION_LOG.md)
