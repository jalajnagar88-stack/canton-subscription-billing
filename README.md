# Canton Subscription Billing

[![CI](https://github.com/your-org/canton-subscription-billing/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/canton-subscription-billing/actions/workflows/ci.yml)

A decentralized, automated solution for managing recurring subscription payments on the Canton Network. This project provides a set of Daml smart contracts to handle the complete subscription lifecycle, from creation and billing to dunning and cancellation, ensuring transparent and enforceable agreements between merchants and subscribers.

## Features

-   **Automated Recurring Billing:** Invoices are generated automatically at the start of each billing cycle.
-   **On-Chain Payment Enforcement:** Payments are settled atomically using Canton's token standards.
-   **Dunning Management:** A built-in workflow handles payment failures, moving subscriptions through a grace period, suspension, and eventual termination.
-   **Transparent Lifecycle:** All state changes (e.g., activation, suspension, cancellation) are recorded immutably on the ledger, visible to both merchant and subscriber.
-   **Mutual Cancellation:** A fair, two-step cancellation process that respects the notice period defined in the agreement.
-   **Queryable State:** Merchants can easily query the ledger for all active, suspended, or delinquent subscriptions for real-time analytics and reporting.

---

## How It Works: The Subscription Lifecycle

The system is modeled around a core `Subscription.daml` contract and its interactions.

1.  **Offer & Acceptance:**
    -   A `Merchant` offers a subscription plan to a `Subscriber`.
    -   The `Subscriber` accepts the offer, creating a `Subscription` contract on the ledger. This contract is the single source of truth for the agreement, viewable by both parties.

2.  **Automated Billing:**
    -   At the start of each billing period, an automated process (e.g., a trigger or off-chain service) calls the `Bill` choice on the active `Subscription` contract.
    -   This action creates an `Invoice` contract, which represents the amount due for the current period.

3.  **Payment & Settlement:**
    -   The `Invoice` is settled by the `Subscriber`. This is typically done via a Delivery-vs-Payment (DVP) transaction, where the subscriber transfers the required digital asset (e.g., a stablecoin) to the merchant in exchange for the invoice being marked as `Paid`.

4.  **Dunning (Handling Failed Payments):**
    -   If an invoice is not paid by its due date, the system automatically transitions the subscription state:
        -   `Active` -> `GracePeriod`: The subscriber is notified and given a few extra days to pay.
        -   `GracePeriod` -> `Suspended`: If payment is still not made, the service is suspended. The contract remains, but the merchant is no longer obligated to provide service.
        -   `Suspended` -> `Terminated`: After a final period, the subscription is terminated and archived.

5.  **Cancellation:**
    -   Either the Merchant or Subscriber can initiate a cancellation by exercising the `RequestCancellation` choice.
    -   This creates a `PendingCancellation` contract. The other party must then confirm the cancellation, which transitions the main `Subscription` to a `Cancelled` state, respecting any predefined notice periods.

---

## Merchant Integration Guide

Integrating this system into your business involves interacting with the Canton ledger to create and manage subscriptions.

### Prerequisites

1.  **A Canton Party ID:** Your business must have a party identity on a Canton network participant node.
2.  **Ledger API Access:** You need access to the JSON API of your participant node to send commands (create contracts, exercise choices).

### Step 1: Define Subscription Plans

First, you must define the terms of your service offerings. While this starter kit doesn't have a dedicated `Plan` template, the core terms are captured directly in the `Subscription` contract upon creation. Key parameters include:

-   `merchant`, `subscriber`: The parties to the agreement.
-   `price`: The amount due each billing period (Decimal).
-   `period`: The billing cycle duration (e.g., 30 days).
-   `gracePeriod`: How long the subscriber has to pay after a due date before suspension.
-   `suspensionPeriod`: How long the service remains suspended before termination.

### Step 2: Onboard a Subscriber

To onboard a new subscriber, you create a `Subscription` contract with the agreed-upon terms.

**Example: Create a Subscription via JSON API**

Send a `POST /v1/create` request to your participant's JSON API endpoint:

```json
{
  "templateId": "Subscription:Subscription",
  "payload": {
    "merchant": "MerchantPartyID::...",
    "subscriber": "SubscriberPartyID::...",
    "price": "99.99",
    "currency": "USD",
    "periodInDays": 30,
    "nextBillingDate": "2024-10-01",
    "gracePeriodInDays": 5,
    "suspensionPeriodInDays": 15,
    "cancellationNoticeInDays": 10,
    "lastBilledDate": null,
    "status": { "tag": "Active", "value": {} }
  }
}
```

This command needs to be submitted with a JWT token for the `merchant`. The subscriber will see the contract proposal and must exercise the `Accept` choice to activate it.

### Step 3: Automate Billing

You need a service that runs periodically (e.g., daily) to check for subscriptions that are due for billing.

1.  **Query for Billable Subscriptions:** Query the ledger for `Subscription` contracts where `nextBillingDate` is today or in the past and the status is `Active`.
2.  **Exercise the `Bill` Choice:** For each contract found, exercise the `Bill` choice. This will generate a new `Invoice`.

**Example: Exercise `Bill` choice via JSON API**

Send a `POST /v1/exercise` request:

```json
{
  "templateId": "Subscription:Subscription",
  "contractId": "00e4e...b1a",
  "choice": "Bill",
  "argument": {}
}
```

### Step 4: Monitor and Manage

Use ledger queries to monitor the health of your subscription business.

-   **Active Subscriptions:** `POST /v1/query` for `Subscription:Subscription` where you are the `merchant`.
-   **Delinquent Subscriptions:** Query for `Subscription` contracts with status `GracePeriod` or `Suspended`.
-   **Invoices:** Query for `Invoice:Invoice` to track paid and unpaid invoices.

For advanced analytics, you can stream ledger data into a database like PostgreSQL using the Participant Query Store (PQS) for complex SQL-based reporting.

---

## For Developers: Local Setup

### Prerequisites

-   **DPM (Canton SDK 3.4.0+):** [Installation Guide](https://docs.digitalasset.com/canton/stable/getting-started/quickstart.html#install-the-sdk)
-   **Node.js v18+ and npm**

### Instructions

1.  **Clone the Repository:**
    ```sh
    git clone https://github.com/your-org/canton-subscription-billing.git
    cd canton-subscription-billing
    ```

2.  **Build Daml Contracts:**
    Compile the Daml code into a DAR (Daml Archive).
    ```sh
    dpm build
    ```
    This generates `.daml/dist/canton-subscription-billing-0.1.0.dar`.

3.  **Run a Local Canton Ledger (Sandbox):**
    Start a local single-node Canton network. The JSON API will be available on port `7575`.
    ```sh
    dpm sandbox
    ```

4.  **Run Daml Script Tests:**
    Execute the test suite defined in `daml/test/`.
    ```sh
    dpm test
    ```

5.  **Run the Frontend (Optional):**
    ```sh
    cd frontend
    npm install
    npm start
    ```
    The React application will be available at `http://localhost:3000`.

## Project Structure

```
.
├── daml/                      # Daml smart contract models
│   ├── Subscription.daml
│   ├── Invoice.daml
│   └── Cancellation.daml
├── daml/test/                 # Daml Script tests
│   ├── SubscriptionTest.daml
│   └── CancellationTest.daml
├── frontend/                  # React-based UI for interacting with the contracts
├── .github/                   # GitHub Actions CI configuration
├── daml.yaml                  # Daml project configuration
└── README.md
```