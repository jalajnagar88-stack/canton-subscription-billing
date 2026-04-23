#!/bin/bash
#
# Copyright (c) 2024 Digital Asset (Canton) Holdings, Inc.
# All rights reserved.
#
# Description:
#   Seeds a local Canton Sandbox with test data for the subscription-billing project.
#   This includes allocating parties for a service provider and several subscribers,
#   and then creating Subscription and BillingSchedule contracts for them.
#
# Usage:
#   1. Make sure a Canton Sandbox is running:
#      dpm sandbox
#   2. Build the Daml model:
#      dpm build
#   3. Run this script from the project root:
#      ./scripts/seed-subscribers.sh
#

set -euo pipefail

# --- Configuration ---
JSON_API_URL="http://localhost:7575"
LEDGER_ID="canton-sandbox"
DAR_FILE_PATTERN=".daml/dist/canton-subscription-billing-*.dar"

# --- Helper Functions ---
log() {
  echo >&2 "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")]" "$@"
}

check_deps() {
  local missing=0
  for cmd in curl jq dpm; do
    if ! command -v "$cmd" &>/dev/null; then
      log "ERROR: Required command '$cmd' is not installed or not in your PATH."
      missing=1
    fi
  done
  [[ "$missing" -eq 0 ]]
}

wait_for_sandbox() {
  log "Waiting for JSON API to be available at $JSON_API_URL..."
  local count=0
  local max_retries=30
  while ! curl -s -f "$JSON_API_URL/v1/health" > /dev/null; do
    if [ "$count" -ge "$max_retries" ]; then
      log "ERROR: JSON API did not become available after $max_retries seconds."
      exit 1
    fi
    count=$((count + 1))
    sleep 1
  done
  log "JSON API is healthy."
}

# Generate a simple, unsigned JWT for local development. DO NOT USE IN PRODUCTION.
generate_jwt() {
  local party="$1"
  local app_id="subscription-billing-seeder"
  local header_b64
  local payload_b64
  header_b64=$(echo -n '{"alg":"none"}' | base64 | tr -d '=' | tr '/+' '_-')
  payload_b64=$(printf '{"https://daml.com/ledger-api":{"ledgerId":"%s","applicationId":"%s","actAs":["%s"]}}' "$LEDGER_ID" "$app_id" "$party" | base64 | tr -d '=' | tr '/+' '_-')
  echo "${header_b64}.${payload_b64}."
}

# Make a request to the JSON API
api_request() {
  local method="$1"
  local endpoint="$2"
  local token="$3"
  local data="$4"
  local auth_header=""

  if [[ -n "$token" ]]; then
    auth_header="-H \"Authorization: Bearer $token\""
  fi

  # Using eval to handle the conditional header correctly
  eval "curl -s -X '$method' \
    -H 'Content-Type: application/json' \
    $auth_header \
    -d '$data' \
    '${JSON_API_URL}${endpoint}'"
}

# --- Main Script ---
main() {
  log "--- Starting Subscription Seeding Script ---"
  check_deps
  wait_for_sandbox

  # --- 1. Find DAR and Package ID ---
  log "Locating project DAR file..."
  local dar_file
  dar_file=$(find . -path "$DAR_FILE_PATTERN" -print -quit)
  if [[ -z "$dar_file" ]]; then
    log "ERROR: Could not find project DAR file matching '$DAR_FILE_PATTERN'. Did you run 'dpm build'?"
    exit 1
  fi
  log "Found DAR: $dar_file"

  log "Extracting main package ID from DAR..."
  local package_id
  package_id=$(dpm damlc inspect-dar --json "$dar_file" | jq -r .main_package_id)
  if [[ -z "$package_id" || "$package_id" == "null" ]]; then
    log "ERROR: Failed to extract package ID from DAR."
    exit 1
  fi
  log "Using Package ID: $package_id"

  # Template IDs
  local subscription_tid="$package_id:Subscription.Model:Subscription"
  local billing_schedule_tid="$package_id:Subscription.Billing:BillingSchedule"

  # --- 2. Allocate Parties ---
  log "Allocating parties..."
  local operator provider subscriber1 subscriber2 subscriber3
  operator=$(api_request POST "/v2/parties/allocate" "" '{"identifierHint": "BillingOperator"}' | jq -r .party)
  provider=$(api_request POST "/v2/parties/allocate" "" '{"identifierHint": "SaasProvider"}' | jq -r .party)
  subscriber1=$(api_request POST "/v2/parties/allocate" "" '{"identifierHint": "AliceSubscriber"}' | jq -r .party)
  subscriber2=$(api_request POST "/v2/parties/allocate" "" '{"identifierHint": "BobSubscriber"}' | jq -r .party)
  subscriber3=$(api_request POST "/v2/parties/allocate" "" '{"identifierHint": "CharlieSubscriber"}' | jq -r .party)

  log "  Operator:    $operator"
  log "  Provider:    $provider"
  log "  Subscriber1: $subscriber1"
  log "  Subscriber2: $subscriber2"
  log "  Subscriber3: $subscriber3"

  # --- 3. Generate Auth Token ---
  local operator_jwt
  operator_jwt=$(generate_jwt "$operator")
  log "Generated JWT for Operator."

  # --- 4. Seed Data ---
  local today next_month
  today=$(date -u +"%Y-%m-%d")
  next_month=$(date -u -d "+1 month" +"%Y-%m-%d")

  # Seed Subscriber 1 (Alice) - Active, Monthly Premium
  seed_subscription \
    "$subscriber1" \
    "Alice" \
    "premium-monthly" \
    '"Active"' \
    "$today" \
    "Monthly" \
    "19.99" \
    5 \
    "$today"

  # Seed Subscriber 2 (Bob) - Active, Annual Basic
  seed_subscription \
    "$subscriber2" \
    "Bob" \
    "basic-annual" \
    '"Active"' \
    "$today" \
    "Annual" \
    "99.00" \
    10 \
    "$next_month"

  # Seed Subscriber 3 (Charlie) - Suspended
  seed_subscription \
    "$subscriber3" \
    "Charlie" \
    "premium-monthly" \
    "{\"tag\": \"Suspended\", \"value\": {\"reason\": \"Payment failed on last cycle.\", \"suspendedOn\": \"$(date -u -d "-3 days" +"%Y-%m-%d")\"}}" \
    "$(date -u -d "-2 months" +"%Y-%m-%d")" \
    "Monthly" \
    "19.99" \
    5 \
    "" # No billing schedule for suspended accounts

  log "--- Seeding Complete ---"
}

seed_subscription() {
  local subscriber_party="$1"
  local subscriber_name="$2"
  local plan_id="$3"
  local status_json="$4"
  local start_date="$5"
  local period="$6"
  local amount="$7"
  local grace_days="$8"
  local next_billing_date="$9"

  log "Seeding subscription for $subscriber_name..."

  # Create Subscription contract
  local sub_payload
  sub_payload=$(cat <<EOF
{
  "templateId": "$subscription_tid",
  "payload": {
    "provider": "$provider",
    "subscriber": "$subscriber_party",
    "operator": "$operator",
    "planId": "$plan_id",
    "status": $status_json,
    "startDate": "$start_date",
    "details": {
      "billingPeriod": "$period",
      "amount": "$amount",
      "currency": "USD",
      "gracePeriodDays": $grace_days
    }
  }
}
EOF
)
  local sub_create_resp sub_cid
  sub_create_resp=$(api_request POST "/v1/create" "$operator_jwt" "$sub_payload")
  sub_cid=$(echo "$sub_create_resp" | jq -r .result.contractId)

  if [[ -z "$sub_cid" || "$sub_cid" == "null" ]]; then
    log "ERROR: Failed to create subscription for $subscriber_name. Response: $sub_create_resp"
    return 1
  fi
  log "  Created Subscription contract: $sub_cid"

  # Create BillingSchedule if a next billing date is provided
  if [[ -n "$next_billing_date" ]]; then
    local sched_payload
    sched_payload=$(cat <<EOF
{
  "templateId": "$billing_schedule_tid",
  "payload": {
    "subscriptionCid": "$sub_cid",
    "provider": "$provider",
    "subscriber": "$subscriber_party",
    "operator": "$operator",
    "nextBillingDate": "$next_billing_date",
    "billingPeriod": "$period",
    "amount": "$amount",
    "currency": "USD"
  }
}
EOF
)
    local sched_create_resp sched_cid
    sched_create_resp=$(api_request POST "/v1/create" "$operator_jwt" "$sched_payload")
    sched_cid=$(echo "$sched_create_resp" | jq -r .result.contractId)

    if [[ -z "$sched_cid" || "$sched_cid" == "null" ]]; then
      log "ERROR: Failed to create billing schedule for $subscriber_name. Response: $sched_create_resp"
      return 1
    fi
    log "  Created BillingSchedule contract: $sched_cid"
  else
    log "  Skipping BillingSchedule creation as requested."
  fi
}

main "$@"