#!/usr/bin/env bash
# Creates the database roles PowerSync uses, once per database (safe to run again):
#   powersync_role     reads the replicated tables through the `powersync` publication
#   powersync_storage  owns the separate `powersync_storage` database for sync buckets
# Passwords come from .env (PS_ROLE_PASSWORD, PS_STORAGE_PASSWORD). Run from the project folder
# after `docker compose up -d db` and `npm run db:migrate`.
set -euo pipefail

set -a
# shellcheck disable=SC1091
source .env
set +a

psql() { docker exec -i oriel-db psql -v ON_ERROR_STOP=1 -U oriel "$@"; }

psql -d oriel -v role_password="$PS_ROLE_PASSWORD" -v storage_password="$PS_STORAGE_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE powersync_role WITH REPLICATION LOGIN PASSWORD %L', :'role_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'powersync_role') \gexec
ALTER ROLE powersync_role WITH PASSWORD :'role_password';
GRANT SELECT ON items, entries, space_member, space TO powersync_role;

SELECT format('CREATE ROLE powersync_storage WITH LOGIN PASSWORD %L', :'storage_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'powersync_storage') \gexec
ALTER ROLE powersync_storage WITH PASSWORD :'storage_password';

SELECT 'CREATE DATABASE powersync_storage OWNER powersync_storage'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'powersync_storage') \gexec
SQL

echo "PowerSync roles and storage database are ready."
