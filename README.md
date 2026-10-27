# Oriel

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Author: **Ákos Kappel**

One calm place for the everyday things you don't want to forget: notes, shopping lists, tasks and quick thoughts, alone or shared with the people you live with. Built mobile-first and offline-first, so it opens instantly and keeps working without a connection.

**Status:** early development. Capture, editing and organization of notes, lists and tasks work fully offline: data lives in a local SQLite database and the app installs as a PWA. Sign-in and sync come next.

## Principles

- **Fast capture:** adding something takes seconds, without forms.
- **Offline-first:** data lives on the device first and syncs when a connection is available.
- **Live collaboration:** shared lists update on every member's device.
- **Private by default:** you see only what you own or what was shared with you.

## Quick capture

The capture field sits at the bottom of the screen. Pick Note, List or Task, type, and press Enter; Shift+Enter starts a new line, and `/` focuses the field on desktop.

- The first line is the title. Further lines become the note body, the task details or the list entries (bullets and `[ ]` are removed).
- A list fits on one line: `Groceries: milk, eggs, bread`.
- A long pasted paragraph becomes a note with a short title and the full text kept.

## Organizing

- **Home:** pinned items first, then open items by priority and date, completed tasks folded away. Filter by notes, lists or tasks; the filter is part of the URL.
- **Search:** finds every word typed in titles, text and list entries, ignoring case and accents. It runs on the device, so it works offline.
- **Detail:** edit the title and text (saved as you type), complete tasks, set a priority (none, low, medium, high), pin, archive, or move to the trash with Undo. Escape closes it, and j and k move to the next and previous item.
- **Archive and trash:** archived items leave home but stay searchable in the archive. Deleted items wait in the trash for 30 days, on every device, and can be restored by anyone who can edit the space; after that a device deletes them for good. In a shared space the trash names who deleted something.
- **Wide screens:** the list stays on the left and the open item reads beside it; on a phone they are separate screens.
- **Lists:** check, rename, remove (or empty the text) and add entries; pasting several lines adds one entry per line, and entries used in earlier lists are suggested while typing. Checked entries move to the bottom; "Clear checked" removes them and "Uncheck all" resets a list for reuse, both with Undo.
- **Settings:** theme (like the device, light or dark), storage used, export of everything as JSON or Markdown, and import of a JSON export (into your own space, skipping what is already there).

## Offline and installable

- A service worker (`scripts/service-worker.js`, emitted as `sw.js` with the build) precaches the app, so it opens and works with no connection after the first visit. New versions are offered with a Reload button, never forced mid-edit.
- Installable as a PWA, with shortcuts for a new note, list or task, and a share target: sharing a link or text from another app on Android creates a note.
- The browser is asked to keep the database (persistent storage) after the first save.

## Accounts

No account is needed: everything works on the device. Creating an account (email and password, with Better Auth) gives you a personal space on the server, and everything you made before signing up moves into it, so nothing is lost. Signing out removes the data from the device, so the next person to use it starts clean.

Deleting the account (with the password) removes it, the personal space and every shared space nobody else uses, on the server and on the device. A shared space others still use must get another owner first, so it is never left without one.

## Sharing

- **Spaces:** your personal space is only yours. Create a shared space (a household, a trip), invite people, and move notes and lists into it. Members see changes from each other within a second.
- **Invites:** an owner creates a link that one person can use within 7 days; only a hash of it is stored. With an email address, Oriel also sends the link (through Resend; without `RESEND_API_KEY` the email is printed in the server output during development). Someone without an account is asked to create one when opening it, and anything already on their device comes along.
- **Roles:** owners manage the space and its members, editors change content, viewers only read (their screens are read-only, and the server refuses their writes). A space always keeps an owner.
- **Who did what:** items another member added show "by Anna", and checked entries and done tasks show who checked them.
- **Leaving:** removing someone, or leaving, takes the space off their devices on the next sync. An owner can leave while another owner stays; the last owner deletes the space instead.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19, file-based routing) on Vite and Nitro
- TypeScript
- React Aria Components for accessible controls, Tailwind CSS v4, Newsreader and Instrument Sans (self-hosted), Lucide icons
- [TanStack DB](https://tanstack.com/db) for reactive client collections and optimistic writes
- [PowerSync](https://www.powersync.com) Web SDK with SQLite (WASM) as the local database
- Zod for validation
- PostgreSQL 18 with Drizzle ORM, Better Auth for accounts
- Planned: syncing the local database with PostgreSQL through PowerSync
- Biome, Vitest, GitHub Actions

## How it works

```mermaid
flowchart LR
  UI[React UI] <--> DB[TanStack DB collections]
  DB <--> Local[(SQLite in the browser)]
  Local -->|upload queue| Upload[App: /api/sync/upload]
  Upload --> PG[(PostgreSQL)]
  PG -->|logical replication| PS[PowerSync Service]
  PS -->|sync stream| Local
```

- **Reads** always come from the local SQLite database, so the app is instant and works offline.
- **Writes** land locally first and wait in PowerSync's upload queue. When online, the app's upload endpoint validates every change and checks that the user may edit that space (owner or editor) before writing it to PostgreSQL. Refused changes are reported and replaced by the server's version.
- **Downloads** come from the self-hosted PowerSync Service, which follows PostgreSQL through logical replication and sends each device only the spaces its user is a member of (`powersync/sync-config.yaml`).
- **Tokens** for the PowerSync Service are short-lived Ed25519 JWTs signed by the app; the service holds only the public key.
- **Security headers:** pages carry a Content-Security-Policy with a fresh nonce per request (scripts only with the nonce, `wasm-unsafe-eval` for SQLite, connections only to the app and the sync service); every response carries HSTS, `nosniff`, a same-origin referrer policy and no framing. Sign-in, sign-up and account deletion are rate-limited per visitor, sync uploads and tokens per user.

## Getting started

Requires Node.js 24 and Docker (PostgreSQL and the PowerSync Service).

```bash
npm install
cp .env.example .env    # set the passwords, BETTER_AUTH_SECRET, and the same DB password in DATABASE_URL
node scripts/generate-sync-keys.mjs >> .env
docker compose up -d db
npm run db:migrate
./scripts/setup-powersync-db.sh
docker compose up -d powersync
npm run dev
```

The app runs at http://localhost:3000 and the PowerSync Service at http://localhost:8086. Without the database the app still works fully on the device; accounts and sync need both services.

## Docker image

The `Dockerfile` builds the app in one stage and runs only the Nitro output in a second: `node:24-slim` with current security patches, no npm, as the unprivileged `node` user, with a health check on `/api/health` (which also checks the database). CI builds the image on every push, fails on fixable high or critical vulnerabilities (Trivy), and pushes `main` to GHCR. Settings come from the environment at run time (see `.env.example`); none are baked into the image.

```bash
docker run --rm -e DATABASE_URL=... ghcr.io/akoskappel/oriel node scripts/migrate.ts   # before starting a new version
docker run -p 3000:3000 --env-file .env ghcr.io/akoskappel/oriel
```

## Scripts

| Command               | What it does                           |
| --------------------- | -------------------------------------- |
| `npm run dev`         | Start the dev server                   |
| `npm run build`       | Build for production into `.output/`   |
| `npm start`           | Run the production build               |
| `npm run check`       | Lint and format check (Biome)          |
| `npm run check:fix`   | Fix lint and formatting                |
| `npm run typecheck`   | Type-check the project                 |
| `npm test`            | Run the unit and component tests       |
| `npm run test:e2e`    | Run the end-to-end tests (Playwright)  |
| `npm run db:generate` | Create a migration from schema changes |
| `npm run db:migrate`  | Apply migrations                       |

## License

[MIT](LICENSE)
