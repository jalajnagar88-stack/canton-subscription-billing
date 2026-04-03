# Canton Subscription Billing

This project provides a robust, decentralized subscription billing and payment enforcement system built on the Canton Network using Daml smart contracts. It enables merchants to offer subscription-based services with automated, transparent, and enforceable payment cycles.

## Overview

The core of the system is a set of Daml templates that model the entire subscription lifecycle, from initial agreement to recurring payments, and handling of delinquencies. By encoding the business logic in smart contracts, all parties (Merchant, Subscriber, and the automated Billing Engine) have a shared, immutable source of truth for every subscription's state.

**Key Features:**
-   **Automated Recurring Payments:** A `BillingEngine` party automatically processes payments at the start of each billing cycle.
-   **Transparent State Management:** All state changes (e.g., payment success, failure, suspension) are recorded on the ledger, visible to authorized parties.
-   **Enforceable Contracts:** The rules for payment failures, grace periods, and service suspension are baked into the smart contracts, ensuring they are followed without manual intervention.
-   **Decentralized & Interoperable:** Built on Canton, allowing different organizations to interact securely without a central intermediary.

## Core Concepts

### Actors

-   **Merchant:** The provider of the service or product. They propose subscription agreements and receive payments.
-   **Subscriber:** The customer who agrees to the subscription terms and authorizes recurring payments.
-   **BillingEngine:** An automated party responsible for triggering the payment processing logic at the start of each billing period.

### Daml Templates

-   **`SubscriptionAgreement`**: The master contract representing an active subscription between a Merchant and a Subscriber. It holds the terms, status, and next billing date.
-   **`SubscriptionAgreementProposal`**: An offer from a Merchant to a Subscriber to enter into a subscription. The Subscriber accepts this to create the `SubscriptionAgreement`.
-   **`PaymentAuthorization`**: A contract created by the Subscriber that gives the `BillingEngine` the authority to pull funds on their behalf for this specific subscription.

## Subscription Lifecycle

1.  **Proposal:** The Merchant creates a `SubscriptionAgreementProposal` and offers it to a potential Subscriber.
2.  **Acceptance:** The Subscriber accepts the proposal, which atomically creates the active `SubscriptionAgreement` and a `PaymentAuthorization` contract.
3.  **Billing Cycle:** On or after the `nextBillingDate`, the `BillingEngine` exercises the `ProcessPayment` choice on the `SubscriptionAgreement`.
4.  **Payment Success:** If payment succeeds, the `nextBillingDate` is advanced to the next period, and the cycle continues.
5.  **Payment Failure:** If payment fails, the subscription status moves to `InGracePeriod`, and a grace period deadline is set.
6.  **Recovery:** If payment is made during the grace period, the subscription returns to `Active`.
7.  **Suspension:** If the grace period expires without payment, the status moves to `Suspended`. The service should be suspended at this point.
8.  **Termination:** The subscription can be terminated by the Subscriber at any time or by the Merchant under specific conditions (e.g., prolonged non-payment).

## Merchant Integration Guide

This guide explains how to interact with the Canton ledger via the JSON API to manage subscriptions.

### Prerequisites

-   A running Canton participant node.
-   A party ID for your Merchant identity on the network.
-   An authentication token (JWT) for the JSON API, configured for your Merchant party.

### Step 1: Create a Subscription Proposal

To onboard a new subscriber, you create a `SubscriptionAgreementProposal` contract.

**Endpoint:** `POST /v1/create`
**Authorization:** `Bearer <your-merchant-jwt>`

**Payload:**

```json
{
  "templateId": "Main:SubscriptionAgreementProposal",
  "payload": {
    "merchant": "MerchantPartyID",
    "subscriber": "SubscriberPartyID",
    "billingEngine": "BillingEnginePartyID",
    "description": "Premium SaaS Plan",
    "price": "19.99",
    "currency": "USD",
    "billingIntervalDays": 30,
    "gracePeriodDays": 5,
    "firstBillingDate": "2024-08-01"
  }
}
```

The subscriber will see this proposal and can choose to accept it. Upon acceptance, the system automatically creates the active `SubscriptionAgreement`.

### Step 2: Query for Active Subscriptions

To get a list of all active subscriptions for your service, you can query the ledger for `SubscriptionAgreement` contracts where you are the merchant.

**Endpoint:** `POST /v1/query`
**Authorization:** `Bearer <your-merchant-jwt>`

**Payload:**

```json
{
  "templateIds": ["Main:SubscriptionAgreement"],
  "query": {
    "merchant": "MerchantPartyID",
    "status": "Active"
  }
}
```

This is useful for your internal systems to verify a user's subscription status before granting access to a service. You can also query for other statuses like `InGracePeriod` or `Suspended`.

### Step 3: Handle Subscription Cancellation (Merchant Initiated)

If you need to terminate a subscription (e.g., service discontinuation), you can exercise the `Cancel` choice on the `SubscriptionAgreement`.

First, you need the Contract ID of the agreement you wish to cancel. You can get this from the query in Step 2.

**Endpoint:** `POST /v1/exercise`
**Authorization:** `Bearer <your-merchant-jwt>`

**Payload:**

```json
{
  "templateId": "Main:SubscriptionAgreement",
  "contractId": "00e8b0b2e3a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
  "choice": "Cancel",
  "argument": {
    "reason": "Service has been discontinued by merchant."
  }
}
```

This will archive the `SubscriptionAgreement` and `PaymentAuthorization`, effectively ending the subscription.

## Running the Project Locally

### Prerequisites

-   Daml SDK v3.1.0
-   Node.js v18+

### Instructions

1.  **Start the Daml Ledger:**
    Open a terminal in the project root and run:
    ```bash
    daml build
    daml start
    ```
    This compiles the Daml code and starts a local Canton ledger with a JSON API endpoint at `http://localhost:7575`.

2.  **Start the Frontend Application:**
    Open a second terminal and navigate to the `frontend` directory:
    ```bash
    cd frontend
    npm install
    npm start
    ```
    This will launch the React-based user interface, which you can access at `http://localhost:3000`.

## Project Structure

```
.
├── daml/                      # Daml smart contract source code
│   └── Main.daml
├── frontend/                  # React frontend application
│   ├── public/
│   └── src/
├── .github/                   # GitHub Actions CI workflow
├── docs/                      # Project documentation
├── daml.yaml                  # Daml project configuration
├── package.json
└── README.md
```