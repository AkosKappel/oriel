# 0003: Conflicts resolve per field, last upload wins

_Status: Accepted · Date: 2026-10-28_

## Context

Two people can change the same list while one of them is offline. When both changes reach the server, one rule has to decide the result, and it should rarely surprise anyone.

## Options

- **Whole-row last write wins:** the later upload replaces the whole row, so checking "Milk" on one phone and renaming it on another loses one of the two.
- **Per-field last write wins:** an edit uploads only the fields it changed (PowerSync's PATCH), so changes to different fields both survive; the same field goes to whichever upload arrives last.
- **CRDTs** (for example Yjs) for text: concurrent typing in one note merges character by character, at the cost of a different storage model for note bodies.

## Decision

Per-field last write wins, which is what PowerSync's upload queue gives when the endpoint applies a PATCH to the changed columns only. List entries are rows of their own, so the common shared case (two people working through one shopping list) never fights over a single field. A row deleted for good stays deleted: a later PATCH of a missing row is skipped.

## Consequences

- Checking and renaming the same entry at once both stick, and so do edits to different items.
- Two people rewriting the same note body at the same time: the later upload replaces the earlier one. Acceptable for now; CRDT note bodies are in the backlog (S-10) if shared notes turn out to need it.
- The rules are explained for users in the README under "How it works".
