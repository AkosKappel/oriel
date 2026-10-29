# 0005: IndexedDB storage for the browser database

_Status: Accepted · Date: 2026-10-29_

## Context

PowerSync runs SQLite in the browser through wa-sqlite, which stores the database file through a virtual file system (VFS). The choice affects speed, whether several open tabs share one database, and Safari support. Changing it later moves the data to another storage area, and notes made without an account exist only on the device, so a switch needs a migration.

## Options

- **IDBBatchAtomicVFS** (PowerSync's default, IndexedDB): works in every browser; tabs share one database through a shared worker, except on Safari and iOS, where each tab opens its own.
- **OPFSCoopSyncVFS** (Origin Private File System): PowerSync's recommendation for several tabs on Safari and iOS; known issues in Safari's private mode.
- **OPFSWriteAheadVFS** and **AccessHandlePoolVFS**: Chromium only, or one tab only.

## Measurements

Production build, Chromium, 390 px, 2,043 items with 10,000 entries (`npm run samples -- --big`), signed out:

|                                | IndexedDB             | OPFSCoopSyncVFS               |
| ------------------------------ | --------------------- | ----------------------------- |
| Import                         | 14 s                  | 20 s                          |
| Home shown                     | 2.3 s (7 s at 4x CPU) | 4.3 to 5.3 s (14 s at 4x CPU) |
| Open a 120-entry list          | 0.75 s                | 1.4 s                         |
| A change shows in a second tab | 0.4 s                 | not within 15 s               |

## Decision

Keep the default IndexedDB VFS.

## Consequences

- No migration of local data.
- On Safari and iOS each tab has its own connection, according to PowerSync's documentation (not tested on Safari yet): a change in one tab should reach another through sync when signed in, and only after a reload when signed out. Phones rarely keep two tabs of the installed app open.
- Revisit when PowerSync's OPFS options carry changes between tabs, or if Safari users report problems.
