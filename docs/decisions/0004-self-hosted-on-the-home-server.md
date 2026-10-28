# 0004: Self-hosted on the home server

_Status: Accepted · Date: 2026-10-28_

## Context

Oriel needs three things running: the app (Node), PostgreSQL with logical replication, and the PowerSync Service. It is a portfolio project with real users' notes, so it needs backups and should cost nothing to run.

## Options

- **Managed free tiers:** Vercel for the app, Supabase for PostgreSQL, PowerSync Cloud for sync. Little to operate, but the database pauses after a week without use and has no backups on the free plan, and three accounts must stay in step.
- **A free cloud VM** (Oracle Cloud Always Free): would run the same Compose stack and never sleeps, but no capacity was available in the region.
- **The home server** that already hosts the other apps: Docker Compose, a Tailscale Funnel sidecar for public HTTPS, images built in CI.

## Decision

The home server, with the stack in `deploy/`: app, PostgreSQL 18, PowerSync 1.27 (Open Edition, bucket storage in PostgreSQL), nginx and a nightly backup container. nginx serves the sync service under `/powersync/` on the app's own hostname, so there is one origin, no CORS and one Funnel port.

## Consequences

- No running cost, and the whole stack is versioned in the repository.
- Uptime depends on one machine at home; an outside monitor checks `/api/health`.
- Backups stay on the same machine until they are copied elsewhere.
- The managed setup and the VM stay in the backlog (X-09, X-10) if the app outgrows the server.
