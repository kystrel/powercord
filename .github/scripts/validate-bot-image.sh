#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:?Usage: validate-bot-image.sh <image-tag>}"
SUFFIX="$(date +%s)-$$"
CONTAINER_NAME="bot-validate-$SUFFIX"
API_NAME="api-validate-$SUFFIX"
NETWORK="bot-validate-$SUFFIX"
cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    docker logs --tail 200 "$CONTAINER_NAME" || true
    docker logs --tail 200 "$API_NAME" || true
  fi
  docker rm -f "$CONTAINER_NAME" "$API_NAME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$NETWORK" >/dev/null
docker run -d --name "$CONTAINER_NAME" --restart unless-stopped --network "$NETWORK" -p 127.0.0.1::3000 \
  -e "API_BASE_URL=http://$API_NAME:3001" "$IMAGE_TAG" >/dev/null
for ((attempt=0; attempt<30; attempt++)); do
  restart_count=$(docker inspect --format '{{.RestartCount}}' "$CONTAINER_NAME")
  if [ "$restart_count" -gt 0 ]; then break; fi
  sleep 1
done
if [ "$restart_count" -eq 0 ]; then
  echo 'Expected bot restart while the API is unavailable' >&2
  exit 1
fi

API_SCRIPT=$(cat <<'JS'
const { createServer } = require('node:http');
const lifts = { squat: 200, bench: 140, deadlift: 250, total: 590, dots: 520 };
const entry = { place: 1, name: 'Taylor #1', sex: 'M', age: 25, equipment: 'Raw', weightClass: 75, bodyWeight: 74, ...lifts };
const meet = { name: 'Test', federation: 'IPF', date: '2026-09-30', year: '2026', url: 'https://example.test/meet', country: 'USA', state: null, town: null, entries: [entry] };
const lifter = { name: entry.name, url: 'https://example.test/lifter', meets: [{ ...entry, federation: meet.federation, date: meet.date, country: meet.country, state: meet.state, name: meet.name, division: 'Open' }], personalBests: [{ equipment: 'Raw', squat: '200', bench: '140', deadlift: '250', total: '590', dots: '520' }] };
const top = [{ name: entry.name, sex: entry.sex, url: lifter.url, ...lifts }];
createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture');
  let body;
  switch (url.pathname) {
    case '/health': body = { status: 'ok' }; break;
    case '/api/lifters': if (url.searchParams.get('name') === entry.name) body = lifter; break;
    case '/api/meets': if (url.searchParams.get('name') === '2026 IPF Test') body = meet; break;
    case '/api/top': body = top; break;
    case '/api/lifters/autocomplete':
      if (url.searchParams.get('query') === 'Ta' && url.searchParams.get('limit') === '2') body = [entry.name];
      break;
    case '/api/meets/autocomplete':
      if (url.searchParams.get('query') === 'Test' && url.searchParams.get('limit') === '2') body = ['2026 IPF Test'];
      break;
    case '/api/status': body = { revision: 'fixture', loadedAt: '2026-09-30T00:00:00Z', lifterCount: 1, meetCount: 1 }; break;
  }
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = body === undefined ? 404 : 200;
  res.end(JSON.stringify(body ?? { error: 'not found' }));
}).listen(3001, '0.0.0.0');
JS
)
docker run -d --name "$API_NAME" --network "$NETWORK" --entrypoint node "$IMAGE_TAG" -e "$API_SCRIPT" >/dev/null
for ((attempt=0; attempt<30; attempt++)); do
  if docker exec "$API_NAME" node -e 'fetch("http://127.0.0.1:3001/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'; then break; fi
  sleep 1
done

for ((attempt=0; attempt<30; attempt++)); do
  PORT=$(docker port "$CONTAINER_NAME" 3000/tcp 2>/dev/null | sed 's/.*://' || true)
  if [ -n "$PORT" ] && curl -fsS "http://127.0.0.1:$PORT/live" >/dev/null; then break; fi
  sleep 2
done
curl -fsS "http://127.0.0.1:$PORT/live" >/dev/null
readiness_status=$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/health")
if [ "$readiness_status" != 503 ]; then
  echo "Expected readiness endpoint to return 503, got $readiness_status" >&2
  exit 1
fi
docker exec -i "$CONTAINER_NAME" node <<'JS'
const assert = require('node:assert/strict');
const { apiClient, checkApiHealth, fetchDataStatus } = require('./dist/data/apiClient');
(async () => {
  await checkApiHealth();
  const lifter = await apiClient.getLifter('Taylor #1');
  assert.equal(lifter.name, 'Taylor #1');
  assert.equal(lifter.meets[0].total, 590);
  assert.equal(lifter.personalBests[0].dots, '520');
  const meet = await apiClient.getMeet('2026 IPF Test');
  assert.equal(meet.name, 'Test');
  assert.equal(meet.entries[0].name, lifter.name);
  assert.equal((await apiClient.getTopLifters())[0].dots, 520);
  assert.deepEqual(await apiClient.getLifterAutocomplete('Ta', 2), [lifter.name]);
  assert.deepEqual(await apiClient.getMeetAutocomplete('Test', 2), ['2026 IPF Test']);
  assert.deepEqual(await fetchDataStatus(), { revision: 'fixture', loadedAt: '2026-09-30T00:00:00Z', lifterCount: 1, meetCount: 1 });
  assert.equal(await apiClient.getLifter('missing'), undefined);
  assert.equal(await apiClient.getMeet('missing'), undefined);
})().catch(error => { console.error(error); process.exitCode = 1; });
JS
docker exec "$CONTAINER_NAME" node -e 'if(require("node:fs").existsSync("dist/data/sqliteClient.js"))process.exit(1)'
docker stop "$CONTAINER_NAME" >/dev/null
