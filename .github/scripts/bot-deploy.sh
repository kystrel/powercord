#!/usr/bin/env bash
set -euo pipefail

IMAGE_SHA="${1:?Usage: bot-deploy.sh <40-char-git-sha>}"
PHASE="${2:-all}"

case "$PHASE" in
  all|wait|deploy) ;;
  *) echo "Unknown deployment phase: ${PHASE}" >&2; exit 2 ;;
esac

if [ "$PHASE" = "deploy" ]; then
  INSTANCE_ID="${3:?Usage: bot-deploy.sh <40-char-git-sha> deploy <instance-id>}"
else
  INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name PowercordBotStack \
    --region us-east-1 \
    --query "Stacks[0].Outputs[?OutputKey=='BotInstanceId'].OutputValue | [0]" \
    --output text)
fi

if [[ ! "$INSTANCE_ID" =~ ^i-([0-9a-f]{8}|[0-9a-f]{17})$ ]]; then
  echo "PowercordBotStack has no valid BotInstanceId. Deploy the stack first." >&2
  exit 1
fi

ssm_poll() {
  local cmd_id="$1" label="$2" max_attempts="${3:-60}"
  for attempt in $(seq 1 "$max_attempts"); do
    local status
    local err
    status=$(aws ssm get-command-invocation \
      --command-id "$cmd_id" \
      --instance-id "$INSTANCE_ID" \
      --region us-east-1 \
      --query "Status" \
      --output text 2>/tmp/ssm_poll_err || true)
    err=$(cat /tmp/ssm_poll_err 2>/dev/null || true)
    [ -n "$err" ] && echo "${label}: aws error: ${err}" >&2
    case "$status" in
      Success)
        echo "${label}: succeeded"
        return 0
        ;;
      Failed|Cancelled|TimedOut|Cancelling)
        echo "${label}: failed with status ${status}" >&2
        aws ssm get-command-invocation \
          --command-id "$cmd_id" \
          --instance-id "$INSTANCE_ID" \
          --region us-east-1 \
          --query "{stdout:StandardOutputContent,stderr:StandardErrorContent}" \
          --output text >&2 || true
        return 1
        ;;
    esac
    echo "${label}: ${status:-Pending} (${attempt}/${max_attempts})"
    sleep 5
  done
  echo "${label}: timed out after ${max_attempts} attempts waiting for command ${cmd_id}" >&2
  return 1
}

if [ "$PHASE" != "deploy" ]; then
  echo "Waiting for ${INSTANCE_ID} to become available in SSM..."
  SSM_READY=
  for attempt in {1..60}; do
    SSM_READY=$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=${INSTANCE_ID}" \
      --region us-east-1 \
      --query "InstanceInformationList[?PingStatus=='Online'].InstanceId | [0]" \
      --output text)
    if [ "$SSM_READY" = "$INSTANCE_ID" ]; then
      break
    fi
    echo "SSM not ready yet (${attempt}/60); retrying..."
    sleep 10
  done
  if [ "$SSM_READY" != "$INSTANCE_ID" ]; then
    echo "Instance ${INSTANCE_ID} did not become SSM Online in time." >&2
    exit 1
  fi

  echo "Waiting for UserData (cloud-init) to complete on ${INSTANCE_ID}..."
  INIT_CMD_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters '{"commands":["cloud-init status --wait; ci_rc=$?; if [ \"$ci_rc\" -ne 0 ] || ! test -f /opt/powercord-start.sh; then echo \"=== /var/log/cloud-init-output.log (last 100 lines) ===\"; tail -100 /var/log/cloud-init-output.log 2>/dev/null || true; echo \"Host initialization failed (cloud-init exit ${ci_rc}) — see log above\" >&2; exit 1; fi"]}' \
    --region us-east-1 \
    --query "Command.CommandId" \
    --output text)
  ssm_poll "$INIT_CMD_ID" "cloud-init" 240

  if [ "$PHASE" = "wait" ]; then
    printf 'instance_id=%s\n' "$INSTANCE_ID" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required for the wait phase}"
    exit 0
  fi
fi

# ── Deploy ────────────────────────────────────────────────────────────────────

echo "Deploying ${IMAGE_SHA} to ${INSTANCE_ID}..."
DEPLOY_CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "{\"commands\":[\"/opt/powercord-start.sh ${IMAGE_SHA}\"]}" \
  --region us-east-1 \
  --query "Command.CommandId" \
  --output text)
ssm_poll "$DEPLOY_CMD_ID" "deploy" 480
