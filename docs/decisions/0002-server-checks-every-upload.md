# 0002: The server checks every upload, the device is never trusted

_Status: Accepted · Date: 2026-10-27_

## Context

With a local-first app, the device holds a full copy of the user's data and writes to it freely. Anyone can open the browser's developer tools and change that copy or the upload queue. Spaces can be shared with roles (owner, editor, viewer), so a write that is fine for one user is forbidden for another.

## Options

- **Trust the device:** apply whatever arrives. Simple, and wrong for shared spaces.
- **Database row-level security:** PostgreSQL policies per user. Strong, but the app connects as one role, and the rules would live far from the code that knows about roles and invites.
- **Check in the app's upload endpoint:** every operation is validated and authorized in TypeScript before it touches PostgreSQL.

## Decision

The upload endpoint (`src/server/upload.ts`) handles each operation in its own savepoint: it validates the fields with the same Zod schemas the client uses, checks that the user may edit the target space (in both spaces when an item moves), and sets server-owned fields itself (`completed_by`, `deleted_by` are always the uploader). A refused operation is reported and dropped; the device then gets the server's version through sync.

Downloads are scoped the same way: the sync streams only select rows in spaces the user is a member of. Auth tables are never replicated. Spaces and memberships are changed only through authenticated server functions (`src/server/sharing.ts`), never through the upload queue.

PowerSync accepts the app's own short-lived Ed25519 tokens (15 minutes, `sub` is the user id); the sync service holds only the public key.

## Consequences

- A tampered device can only damage what its user may already edit, and only through validated fields.
- Every new rule needs a test in `src/server/upload.test.ts`, and client and server schemas must stay in step (both import `src/data/schema.ts`).
- Viewers get read-only screens as a courtesy; the server would refuse their writes anyway.
