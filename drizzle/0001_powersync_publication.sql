-- PowerSync replicates only what clients sync: content and the memberships that decide access.
-- Auth tables (password hashes, session tokens) stay out of the replication stream.
CREATE PUBLICATION powersync FOR TABLE items, entries, space_member;
