# 0001: PowerSync for local-first sync

_Status: Accepted · Date: 2026-10-27_

## Context

Oriel has to open instantly, work with no connection for days, and keep shared lists in step between people. That rules out a classic client that fetches from an API: every read and write has to hit a database on the device, with sync as a background job. The server still has to be the authority over who may see and change what. The project brief set the stack (TypeScript, TanStack Start, TanStack DB, PowerSync, SQLite in the browser, PostgreSQL).

## Options

- **Own sync protocol** over the app's API: full control, but change tracking, ordering, retries, resumable downloads and partial replication would all be hand-written and hand-tested.
- **A hosted realtime backend** (Firebase, Supabase Realtime): quick to start, but online-first, with offline support as a cache rather than the source of truth, and the data model tied to the vendor.
- **PowerSync**: SQLite on the device, a service that follows PostgreSQL through logical replication and streams each user their slice, and an upload queue that the app drains through its own endpoint. Self-hostable (Open Edition).

## Decision

PowerSync, self-hosted, with TanStack DB on top as the reactive layer the UI reads from. PowerSync is the sync engine; TanStack DB never talks to the network.

## Consequences

- Reads are local SQLite queries, so screens render without waiting, online or not.
- Writes go through the app's own upload endpoint, which is where every permission check lives ([0002](0002-server-checks-every-upload.md)).
- What each device downloads is declared in `powersync/sync-config.yaml` and scoped by space membership.
- The server runs one more service (PowerSync, about 120 MB) and PostgreSQL needs `wal_level=logical`.
- Conflict handling follows PowerSync's row and field model ([0003](0003-per-field-last-write-wins.md)).
