# Oriel

A mobile-first, offline-first app for notes, lists and tasks, with live sync and sharing. The workspace rules in `~/projects/AGENTS.md` apply; this file adds what is specific to Oriel.

## Commands

npm only (`package-lock.json`).

| Command             | What it does                           |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Dev server on port 3000                |
| `npm run check:fix` | Biome format, lint and import sort     |
| `npm run typecheck` | Regenerates the route tree, then `tsc` |
| `npm test`          | Vitest, `src/**/*.test.{ts,tsx}`       |
| `npm run build`     | Production build into `.output/`       |

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
- Tests run the same store against real SQLite through `@powersync/node` (`src/data/store.test.ts`).
- `@tanstack/react-db` and `@tanstack/powersync-db-collection` are pinned together; both must depend on the same `@tanstack/db` version.

## Conventions

- Imports from `src` use the `#/` alias (`#/lib/utils`).
- Routes are files in `src/routes`; `src/routeTree.gen.ts` is generated, never edit it.
- UI primitives come from shadcn (`npx shadcn@latest add <name>`) into `src/components/ui`.
- Styling is Tailwind v4 with the tokens in `src/styles.css`. Dark mode follows the system.
- Check the official docs for the installed version of TanStack Start, TanStack DB and PowerSync before using an API; they change quickly.
