// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { ActiveSubscription, Invoice, SubscriptionRequest } from "./daml-types";

// Generic type for a Daml contract fetched from the JSON API
export interface Contract<T> {
  contractId: string;
  templateId: string;
  payload: T;
}

// Environment variable for the JSON API URL, with a fallback for local development
const JSON_API_URL = process.env.REACT_APP_JSON_API_URL || 'http://localhost:7575';
const LEDGER_ID = process.env.REACT_APP_LEDGER_ID || "sandbox" // Not used in v1 API but good practice

/**
 * Returns the standard headers for a JSON API request.
 * @param token The JWT token for authentication.
 */
const getHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

/**
 * A helper function to wrap fetch calls to the JSON API, handling errors and JSON parsing.
 * @param endpoint The API endpoint to call (e.g., '/v1/create').
 * @param token The JWT token.
 * @param options The fetch options (method, body, etc.).
 */
const apiFetch = async <T>(endpoint: string, token: string, options: RequestInit): Promise<T> => {
  const response = await fetch(`${JSON_API_URL}${endpoint}`, {
    ...options,
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("JSON API Error:", response.status, errorBody);
    // Attempt to parse error for more specific message
    try {
      const errorJson = JSON.parse(errorBody);
      const errorMessage = errorJson?.errors?.join(', ') || errorBody;
      throw new Error(`API request failed: ${errorMessage}`);
    } catch {
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }
  }

  // Handle cases with no response body (e.g., successful exercises)
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  return response.json();
};

// =================================================================================================
// Subscription Lifecycle Service
// =================================================================================================

/**
 * Creates a subscription request on behalf of a subscriber.
 * @param token The subscriber's party token.
 * @param subscriber The subscriber party ID.
 * @param vendor The vendor party ID.
 * @param planId An identifier for the subscription plan.
 * @param paymentMethodCid The ContractId of the payment method authorization contract (e.g., a token holding).
 */
const createSubscriptionRequest = async (
  token: string,
  subscriber: string,
  vendor: string,
  planId: string,
  paymentMethodCid: string
): Promise<Contract<SubscriptionRequest>> => {
  const command = {
    templateId: "Subscription.Subscription:Request",
    payload: { subscriber, vendor, planId, paymentMethodCid },
  };
  const response = await apiFetch<{result: Contract<SubscriptionRequest>}>('/v1/create', token, {
    method: 'POST',
    body: JSON.stringify(command),
  });
  return response.result;
};

/**
 * Accepts a subscription request on behalf of the vendor.
 * @param token The vendor's party token.
 * @param requestContractId The ContractId of the Subscription.Request to accept.
 */
const acceptSubscriptionRequest = async (
  token: string,
  requestContractId: string
): Promise<any> => {
  const command = {
    templateId: "Subscription.Subscription:Request",
    contractId: requestContractId,
    choice: "Accept",
    argument: {}, // Assuming the Accept choice takes no arguments
  };
  return apiFetch('/v1/exercise', token, {
    method: 'POST',
    body: JSON.stringify(command),
  });
};

/**
 * Initiates the cancellation of an active subscription on behalf of the subscriber.
 * @param token The subscriber's party token.
 * @param activeSubscriptionCid The ContractId of the Subscription.Active contract.
 * @param reason A textual reason for the cancellation.
 */
const requestSubscriptionCancellation = async (
  token: string,
  activeSubscriptionCid: string,
  reason: string
): Promise<any> => {
  const command = {
    templateId: "Subscription.Subscription:Active",
    contractId: activeSubscriptionCid,
    choice: "RequestCancellation",
    argument: { reason },
  };
  return apiFetch('/v1/exercise', token, {
    method: 'POST',
    body: JSON.stringify(command),
  });
};

// =================================================================================================
// Ledger Query Service
// =================================================================================================

/**
 * Queries the ledger for active subscriptions visible to the party.
 * @param token The party's token.
 */
const queryActiveSubscriptions = async (token: string): Promise<Contract<ActiveSubscription>[]> => {
  const query = { templateIds: ["Subscription.Subscription:Active"] };
  const response = await apiFetch<{result: Contract<ActiveSubscription>[]}>('/v1/query', token, {
    method: 'POST',
    body: JSON.stringify(query),
  });
  return response.result || [];
};

/**
 * Queries the ledger for pending subscription requests visible to the party.
 * @param token The party's token.
 */
const querySubscriptionRequests = async (token: string): Promise<Contract<SubscriptionRequest>[]> => {
  const query = { templateIds: ["Subscription.Subscription:Request"] };
  const response = await apiFetch<{result: Contract<SubscriptionRequest>[]}>('/v1/query', token, {
    method: 'POST',
    body: JSON.stringify(query),
  });
  return response.result || [];
};

/**
 * Queries the ledger for invoices visible to the party.
 * @param token The party's token.
 * @param filter Optional query object to filter invoices by payload fields.
 */
const queryInvoices = async (token: string, filter?: Record<string, any>): Promise<Contract<Invoice>[]> => {
  const query = {
    templateIds: ["Invoice.Invoice:Invoice"],
    query: filter,
  };
  const response = await apiFetch<{result: Contract<Invoice>[]}>('/v1/query', token, {
    method: 'POST',
    body: JSON.stringify(query),
  });
  return response.result || [];
};

/**
 * A convenience function to fetch all invoices for a specific subscription.
 * @param token The party's token.
 * @param subscriptionCid The ContractId of the subscription to fetch invoices for.
 */
const queryInvoicesForSubscription = (token: string, subscriptionCid: string): Promise<Contract<Invoice>[]> => {
  return queryInvoices(token, { subscriptionCid });
};

/**
 * Main service object that bundles all functions for export.
 */
export const billingService = {
  createSubscriptionRequest,
  acceptSubscriptionRequest,
  requestSubscriptionCancellation,
  queryActiveSubscriptions,
  querySubscriptionRequests,
  queryInvoices,
  queryInvoicesForSubscription,
};