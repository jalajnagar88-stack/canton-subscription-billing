#!/bin/bash
#
# Seeds the ledger with test subscribers, payment authorisations, and billing schedules.
# This script assumes a local Canton participant is running and its ledger API
# is accessible on the configured host and port.

set -euo pipefail

# --- Configuration ---
# The Canton participant's Ledger API (gRPC) endpoint.
# Note: This is NOT the JSON API port (7575). daml script uses gRPC.
# Common ports for a local Canton participant are 5011, 5021, etc.
LEDGER_HOST="localhost"
LEDGER_PORT="5011"
PROJECT_NAME="canton-subscription-billing"
DAR_FILE=".daml/dist/${PROJECT_NAME}-0.1.0.dar"
PARTIES_FILE="parties.json"
# We assume a seed script exists within the BillingTest module.
SCRIPT_NAME="Test.BillingTest:seed"

# --- Main Script ---

echo "Building Daml project to ensure the DAR file is up-to-date..."
daml build

echo "------------------------------------------------------------"
echo " Allocating parties on ledger at ${LEDGER_HOST}:${LEDGER_PORT}"
echo "------------------------------------------------------------"

# Allocate all necessary parties in a single call.
# The output is a JSON object mapping display names to party identifiers.
daml ledger allocate-parties --host $LEDGER_HOST --port $LEDGER_PORT \
  Provider \
  BillingEngine \
  SubscriberA \
  SubscriberB \
  SubscriberC > $PARTIES_FILE

# Extract party IDs using jq for logging purposes.
PROVIDER=$(jq -r '.Provider' $PARTIES_FILE)
BILLING_ENGINE=$(jq -r '.BillingEngine' $PARTIES_FILE)
SUBSCRIBER_A=$(jq -r '.SubscriberA' $PARTIES_FILE)
SUBSCRIBER_B=$(jq -r '.SubscriberB' $PARTIES_FILE)
SUBSCRIBER_C=$(jq -r '.SubscriberC' $PARTIES_FILE)

echo "Parties allocated and saved to ${PARTIES_FILE}:"
echo "  Provider:       ${PROVIDER}"
echo "  BillingEngine:  ${BILLING_ENGINE}"
echo "  SubscriberA:    ${SUBSCRIBER_A}"
echo "  SubscriberB:    ${SUBSCRIBER_B}"
echo "  SubscriberC:    ${SUBSCRIBER_C}"

echo "------------------------------------------------------------"
echo " Running Daml script to seed the ledger..."
echo " Script: ${SCRIPT_NAME}"
echo " DAR:    ${DAR_FILE}"
echo "------------------------------------------------------------"

# Run the Daml script, passing the allocated party identifiers via the input file.
# The script will create Subscription, PaymentAuthorisation, and BillingCycle contracts.
daml script \
  --ledger-host $LEDGER_HOST \
  --ledger-port $LEDGER_PORT \
  --dar $DAR_FILE \
  --script-name "${SCRIPT_NAME}" \
  --input-file $PARTIES_FILE

echo ""
echo "✅ Seed script completed successfully."
echo "You can now query the ledger for the created contracts."
echo "The party details are available in ${PARTIES_FILE}."