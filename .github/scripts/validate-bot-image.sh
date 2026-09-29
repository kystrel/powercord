#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:?Usage: validate-bot-image.sh <image-tag>}"
DATA_DIR=$(mktemp -d)
CONTAINER_NAME="bot-validate-$(basename "$DATA_DIR")"

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    docker logs --tail 200 "$CONTAINER_NAME" || true
  fi
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

python3 - "$DATA_DIR/current.sqlite" <<'PY'
import sqlite3
import sys

db = sqlite3.connect(sys.argv[1])
db.executescript("""
    CREATE TABLE metadata (schema_version INTEGER, source_revision TEXT, lifters INTEGER, meets INTEGER);
    CREATE TABLE lifters (name TEXT);
    CREATE TABLE meets (meet_date TEXT, federation TEXT, meet_name TEXT);
    INSERT INTO metadata VALUES (1, 'validation', 0, 0);
""")
db.close()
PY
chmod 755 "$DATA_DIR"
chmod 644 "$DATA_DIR/current.sqlite"

docker run -d --name "$CONTAINER_NAME" -p 3000:3000 \
  --mount "type=bind,source=$DATA_DIR,target=/data,readonly" \
  -e SQLITE_PATH=/data/current.sqlite "$IMAGE_TAG"

echo "Waiting for liveness endpoint..."
for attempt in {1..30}; do
  echo "Liveness check attempt ${attempt}/30"
  if curl -sf http://localhost:3000/live >/dev/null; then
    echo "Liveness check passed"
    break
  fi
  sleep 2
done

if ! curl -sf http://localhost:3000/live >/dev/null; then
  echo "Container did not become live in time" >&2
  exit 1
fi

readiness_status=$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:3000/health)
if [ "$readiness_status" != "503" ]; then
  echo "Expected readiness endpoint to return 503, got ${readiness_status}" >&2
  exit 1
fi

docker stop "$CONTAINER_NAME" >/dev/null
