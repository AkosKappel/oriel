#!/usr/bin/env bash
# Creates the database roles PowerSync uses (scripts/powersync-roles.sql; safe to run again).
# Passwords come from .env (PS_ROLE_PASSWORD, PS_STORAGE_PASSWORD). Run from the project folder
# after `docker compose up -d db` and `npm run db:migrate`.
set -euo pipefail

set -a
# shellcheck disable=SC1091
source .env
set +a

docker exec -i oriel-db psql -v ON_ERROR_STOP=1 -U oriel -d oriel \
  -v role_password="$PS_ROLE_PASSWORD" -v storage_password="$PS_STORAGE_PASSWORD" \
  <scripts/powersync-roles.sql

echo "PowerSync roles and storage database are ready."
