# Oriel

A mobile-first, offline-first app for notes, lists and tasks, with live sync and sharing. The workspace rules in `~/projects/AGENTS.md` apply; this file adds what is specific to Oriel.

## Commands

npm only (`package-lock.json`).

| Command               | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Dev server on port 3000                             |
| `npm run check:fix`   | Biome format, lint and import sort                  |
| `npm run typecheck`   | Regenerates the route tree, then `tsc`              |
| `npm test`            | Vitest, `src/**/*.test.{ts,tsx}`                    |
| `npm run build`       | Production build into `.output/`                    |
| `npm run db:generate` | Migration from changes in `src/server/db/schema.ts` |
| `npm run db:migrate`  | Apply migrations (`docker compose up -d db` first)  |

Run `check`, `typecheck`, `test` and `build` before committing; CI runs the same.

## Architecture

- **Data flow:** UI reads and writes TanStack DB collections. PowerSync keeps the local SQLite database in sync with PostgreSQL. TanStack DB is the reactive client layer, not the sync engine.
- **Local first:** every read comes from the local database and every write lands there first. Never block the UI on the network.
- **Server is authoritative** for shared data and permissions. Never trust local data for access control; enforce it in the server's sync rules and upload handler.
- **Mutations are idempotent:** client-generated UUIDs as primary keys, so a retried upload cannot create duplicates.
- **Generic content model:** content items have a type (note, list, task); list entries are separate rows. Do not design tables around one use case such as shopping.
- **Layers:** route components compose UI; domain logic and persistence live outside components so they can be tested without React.
- **Build in order:** foundation, local data, quick capture, core organization, offline, backend and auth, sync, sharing, polish. Do not add sync or auth code before the phase that needs it.

## Data layer

- `src/data/schema.ts`: the PowerSync table schema plus Zod schemas for rows and inputs. PowerSync views are schemaless, so adding a column needs no client migration.
- `src/data/store.ts`: `createStore(database)` builds the TanStack DB collections and every write operation. Writes validate input, apply optimistically and resolve once stored in SQLite. Writes that span tables use one `createTransaction` with `PowerSyncTransactor`.
- `src/data/client.ts`: the browser database and store. Routes that read it set `ssr: false`; during server rendering PowerSync only opens a placeholder.
- `src/data/capture.ts` and `src/data/organize.ts` hold the pure parsing and sorting rules; keep that logic out of components and cover it with unit tests.
- Deletes return a `Snapshot`; `restore(snapshot)` is how every Undo works.
- Tests run the same store against real SQLite through `@powersync/node` (`src/data/store.test.ts`).
- `@tanstack/react-db` and `@tanstack/powersync-db-collection` are pinned together; both must depend on the same `@tanstack/db` version.

## Server and accounts

- PostgreSQL 18 (`compose.yaml`, port 5437, `wal_level=logical` for PowerSync) with Drizzle; schema in `src/server/db/schema.ts`, migrations in `drizzle/` (generated, committed).
- `src/env.ts` validates server settings on first use; `.env.example` lists them. Server code lives in `src/server` and is only imported by server routes and server functions.
- Better Auth (`src/server/auth.ts`, email and password) behind `/api/auth/$`. Every user has one personal space (`ensurePersonalSpace`, idempotent through the unique `personal_owner_id`).
- Accounts are optional. The client remembers the account in localStorage (`src/lib/account.ts`) so new items get `space_id` and `created_by` offline. At sign-in, `claimLocalData` moves rows without a space into the personal space; signing out clears the device (`disconnectAndClear`).
- Server tests (`src/server/*.test.ts`) need the database and are skipped without `DATABASE_URL`; they clean up the users they create.

## Sync

- PowerSync Service 1.27 runs in `compose.yaml` (port 8086, config in `powersync/`). It replicates `items`, `entries` and `space_member` through the `powersync` publication (migration `0001`); auth tables are never replicated. Roles and the separate `powersync_storage` database come from `scripts/setup-powersync-db.sh` (idempotent).
- Downloads: `powersync/sync-config.yaml`, edition 3 sync streams, scoped by `space_member`. Timestamps arrive in the same ISO format the client writes (`timestamp_max_precision: milliseconds`).
- Uploads: `src/data/connector.ts` sends the queue to `/api/sync/upload`; `src/server/upload.ts` validates and checks membership per operation in a savepoint. Rejected operations are reported and dropped; 401 and 5xx keep the batch for a retry. Keep the server rules in step with the client's Zod schemas (both import `src/data/schema.ts`).
- Tokens: `/api/sync/token` signs an Ed25519 JWT (`src/server/sync-token.ts`, `sub` = user id, `aud` = `oriel`, 15 minutes). Keys from `scripts/generate-sync-keys.mjs`; PowerSync gets the public key via `PS_` variables. Without the keys, sync is off and the app stays local.
- Claiming re-inserts rows (DELETE plus full PUT) so the server can create them; a PATCH of a row it never received would be skipped.
- Server upload tests (`src/server/upload.test.ts`) cover the permission rules; extend them with every new rule.

## Sharing

- Rules live in `src/server/sharing.ts` (owners invite, rename, change roles, remove; a personal space is never shared; a space always keeps an owner; invites are single use, 7 days, stored as a SHA-256 hash). `src/server/sharing-functions.ts` wraps them as authenticated server functions; errors carry user-facing messages.
- Spaces and memberships sync to devices (`space`, `space_member` with `member_name` copied at join, so the `user` table never replicates). The client never writes these tables; it calls the server functions and waits for sync.
- `useSpaces()` (`src/lib/spaces.ts`) gives the user's spaces and role offline; `canEdit` drives read-only screens for viewers.
- Moving an item between spaces re-inserts it and its entries (`moveItem`), so the server checks edit rights in both spaces.
- Shared spaces have no owner column: deleting a user does not delete them. Account deletion must remove spaces where the user is the last member (B-06).

## Offline

- `scripts/service-worker.js` is a template; `scripts/service-worker-plugin.ts` fills in the precache list and emits `sw.js` with the client build. It must be emitted during the build: Nitro only serves files it knows when it bundles.
- The worker only runs in production builds; test offline with `npm run build` and `npm start`.
- Long text fields save when the page is hidden, not only on unmount.

## Conventions

- Imports from `src` use the `#/` alias (`#/lib/utils`).
- Routes are files in `src/routes`; `src/routeTree.gen.ts` is generated, never edit it.
- Interactive primitives are React Aria Components, wrapped in `src/components/ui` (`Checkbox`, `ChoiceGroup`). Use React Aria (`Button`, `ToggleButton`, `RadioGroup`, ...) for new controls; style their states with Tailwind data variants (`data-selected:`, `data-focus-visible:`, `data-pressed:`).
- Visual direction is "Paper": serif (Newsreader) for content, small sans (Instrument Sans) for controls and metadata, whitespace instead of borders and boxes, the selected option underlined. Titles share one column; checkboxes sit in the left margin (`pl-10` on the content, `-left-[2.375rem]` on the checkbox).
- Styling is Tailwind v4 with the tokens in `src/styles.css`. Colors are placeholders until the owner picks a palette; keep every color in the tokens. Dark mode follows the system.
- Check the official docs for the installed version of TanStack Start, TanStack DB and PowerSync before using an API; they change quickly.
