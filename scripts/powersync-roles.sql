-- The database roles PowerSync uses; safe to run again. Needs the psql variables
-- role_password and storage_password, and runs after the migrations (it grants on their tables):
--   powersync_role     reads the replicated tables through the `powersync` publication
--   powersync_storage  owns the separate `powersync_storage` database for sync buckets
-- Run by scripts/setup-powersync-db.sh in development and by the powersync-setup service in
-- production (deploy/compose.yaml).

SELECT format('CREATE ROLE powersync_role WITH REPLICATION LOGIN PASSWORD %L', :'role_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'powersync_role') \gexec
ALTER ROLE powersync_role WITH PASSWORD :'role_password';
GRANT SELECT ON items, entries, space_member, space TO powersync_role;

SELECT format('CREATE ROLE powersync_storage WITH LOGIN PASSWORD %L', :'storage_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'powersync_storage') \gexec
ALTER ROLE powersync_storage WITH PASSWORD :'storage_password';

SELECT 'CREATE DATABASE powersync_storage OWNER powersync_storage'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'powersync_storage') \gexec
