# Subscription Billing Specification

## 1. Overview

This document specifies the business logic for the recurring subscription billing and payment enforcement system built on Canton. It defines the lifecycle of a subscription, the process of a billing cycle, and the automated handling of payment failures, including grace periods, retries, and service state changes.

The system is designed to be automated, transparent, and enforceable through Daml smart contracts, ensuring both the service provider and the subscriber have a clear, shared understanding of the agreement terms.

## 2. Key Entities

-   **Provider**: The party offering a service and collecting subscription fees.
-   **Subscriber**: The party consuming the service and paying subscription fees.
-   **Subscription Agreement**: A Daml contract representing the active, ongoing agreement between the Provider and the Subscriber. It contains key terms like price, currency, and billing interval.
-   **Billing Engine**: An automated off-ledger process or on-ledger contract (e.g., triggered by a `TimeManager` service) that initiates the billing cycle.

## 3. Subscription Lifecycle States

A subscription contract progresses through a series of states based on payment status.

| State           | Description                                                                                             | Transitions To                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Pending`       | The initial state after a subscription proposal is made but before the subscriber has accepted.         | `Active` (on acceptance)                                                     |
| `Active`        | The subscription is in good standing. The service is available to the subscriber.                       | `InGracePeriod` (on payment failure), `Terminated` (on cancellation)         |
| `InGracePeriod` | A payment has failed. The service remains available for a limited time while payment is retried.        | `Active` (on successful retry), `Suspended` (on grace period expiration)     |
| `Suspended`     | The grace period has expired without successful payment. The service is unavailable to the subscriber.  | `Active` (on manual payment of dues), `Terminated` (on suspension expiration)|
| `Terminated`    | The subscription has been permanently ended, either by cancellation or by prolonged non-payment.         | (End State)                                                                  |

## 4. Billing Cycle

The billing cycle is the core process for charging the subscriber.

1.  **Trigger**: On or after the `nextBillingDate` stored in the `SubscriptionAgreement` contract, the Billing Engine initiates the process.
2.  **Invoice Creation**: The system generates a `PaymentRequest` contract for the billing period amount. This contract is owed by the Subscriber to the Provider.
3.  **Payment Attempt**: The Provider exercises a choice on the `PaymentRequest` to automatically debit the funds from a pre-authorized account or contract designated by the Subscriber.
    -   **On Success**: The `PaymentRequest` is marked as `Paid` and archived. The `SubscriptionAgreement` contract's `lastPaidDate` and `nextBillingDate` are updated. The subscription remains `Active`.
    -   **On Failure**: The `PaymentRequest` is marked as `Failed`. The `SubscriptionAgreement` contract transitions to the `InGracePeriod` state.

## 5. Failed Payment Handling

This process is initiated immediately upon a failed payment attempt.

### 5.1. Grace Period

-   **Entry**: The `SubscriptionAgreement` contract transitions to the `InGracePeriod` state.
-   **Duration**: **7 calendar days** from the date of the initial payment failure.
-   **Service Status**: The service remains fully accessible to the Subscriber during the grace period.
-   **Notifications**: The system should notify the Subscriber of the payment failure and the start of the grace period.

### 5.2. Retry Logic

Within the grace period, the Billing Engine will automatically retry the payment.

-   **Retry Schedule**:
    -   **Retry 1**: 3 days after the initial failure.
    -   **Retry 2**: 5 days after the initial failure.
    -   **Retry 3**: 7 days after the initial failure (on the final day of the grace period).
-   **Successful Retry**: If any retry attempt succeeds, the `SubscriptionAgreement` immediately transitions back to the `Active` state. The `nextBillingDate` is calculated from the *original* due date, not the date of the successful retry.
-   **Failed Retries**: If all retries fail, the grace period expires.

## 6. Service Suspension

-   **Trigger**: The grace period ends without a successful payment.
-   **State Transition**: The `SubscriptionAgreement` contract transitions to the `Suspended` state.
-   **Effect**: The Subscriber's access to the service is revoked. Off-ledger systems should enforce this based on the contract state.
-   **Duration**: The subscription will remain in the `Suspended` state for **30 calendar days**.
-   **Reactivation**: The Subscriber can reactivate the service at any point during the suspension period by manually paying all outstanding invoices. Upon successful payment, the contract returns to the `Active` state.

## 7. Termination

-   **Trigger 1 (Non-Payment)**: The 30-day suspension period expires without payment.
-   **Trigger 2 (Cancellation)**: The Subscriber or Provider explicitly exercises a cancellation choice on the `SubscriptionAgreement` contract. Subscriber cancellation is effective at the end of the current paid billing period.
-   **Effect**: The `SubscriptionAgreement` contract is archived, permanently ending the relationship. Outstanding invoices may remain for collection purposes.

## 8. Specification Parameters

| Parameter                   | Value            | Description                                                            |
| --------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Billing Interval            | Monthly          | Frequency of billing cycles.                                           |
| Grace Period Duration       | 7 days           | Time after a failed payment where the service remains active.          |
| Retry Attempts              | 3                | Number of automatic payment retries during the grace period.           |
| Retry Schedule (Days After Failure) | `[3, 5, 7]`    | The specific days on which retries are attempted.                      |
| Suspension Period Duration  | 30 days          | Time a subscription remains suspended before being terminated.         |
| Cancellation Policy         | End of term      | Subscriber cancellation is effective at the end of the paid-for period.|