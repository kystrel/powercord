#!/usr/bin/env bash
set -euo pipefail

for ((attempt=0; attempt<60; attempt++)); do
  run_id=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow ci.yml \
    --commit "$GITHUB_SHA" --branch master --limit 20 --json databaseId,event,number \
    --jq 'map(select(.event == "push" or .event == "workflow_dispatch")) | max_by(.number).databaseId // empty')
  if [[ -n "$run_id" ]]; then
    gh run watch "$run_id" --repo "$GITHUB_REPOSITORY" --exit-status --interval 30
    exit 0
  fi
  sleep 2
done

echo "No master CI run found for $GITHUB_SHA" >&2
exit 1
