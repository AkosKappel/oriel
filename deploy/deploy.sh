#!/usr/bin/env bash
# Deploys a new Oriel image. Run in the deploy folder (~/deploy/oriel):
#   ./deploy.sh              the commit of the latest green CI run on main
#   ./deploy.sh sha-1234567  a specific image tag (also how to roll back)
# Steps: check the image exists, dump the database, switch IMAGE_TAG, pull, start (the
# migrate container runs first), wait for the health check, run the smoke test. Nothing is
# rolled back automatically: migrations only move forward, so the script prints the command
# for going back instead. Every deploy is appended to deploys.log.
set -euo pipefail
# Dumps hold users' notes: readable by the owner only.
umask 077
cd "$(dirname "$0")"

repo=AkosKappel/oriel
image=ghcr.io/akoskappel/oriel
url=$(grep '^BETTER_AUTH_URL=' .env | cut -d= -f2-)
backup_dir=$(grep '^BACKUP_DIR=' .env | cut -d= -f2-)
previous=$(grep '^IMAGE_TAG=' .env | cut -d= -f2-)

if [[ $# -ge 1 ]]; then
  tag=$1
else
  sha=$(gh run list -R "$repo" --workflow ci.yml --branch main --status success \
    --limit 1 --json headSha --jq '.[0].headSha')
  [[ -n "$sha" ]] || { echo "No green CI run on main found" >&2; exit 1; }
  tag="sha-${sha:0:7}"
fi

if [[ "$tag" == "$previous" ]]; then
  echo "Already running $tag"
  exit 0
fi
docker manifest inspect "$image:$tag" >/dev/null ||
  { echo "Image $image:$tag not found on GHCR" >&2; exit 1; }

echo "Deploying $tag (running: $previous)"

# A dump right before the migrations, kept with the nightly ones (14 days).
dump="$backup_dir/oriel-$(date +%F)-before-$tag.dump"
docker compose exec -T db pg_dump -U oriel -d oriel --format=custom >"$dump.part"
mv "$dump.part" "$dump"
echo "Database saved to $dump ($(du -h "$dump" | cut -f1))"

sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" .env
docker compose pull -q migrate app
docker compose up -d

echo -n "Waiting for the app to be healthy"
for _ in $(seq 1 60); do
  state=$(docker inspect -f '{{.State.Health.Status}}' oriel-prod-app 2>/dev/null || true)
  [[ "$state" == "healthy" ]] && break
  echo -n .
  sleep 2
done
echo " $state"

result=failed
if [[ "$state" == "healthy" ]] && node smoke.ts "$url"; then
  result=ok
fi
echo "$(date -Iseconds) $previous -> $tag $result" >>deploys.log

if [[ "$result" != ok ]]; then
  echo "Deploy of $tag failed. Logs: docker compose logs migrate powersync-setup app powersync" >&2
  echo "Back to the previous version (same database schema only): ./deploy.sh $previous" >&2
  echo "Data as it was before: see the restore command in operations.md, with $dump" >&2
  exit 1
fi
echo "Deployed $tag"
