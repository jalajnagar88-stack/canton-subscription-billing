# Subscription Billing Lifecycle Specification

This document outlines the complete lifecycle of a subscription agreement, from its active state through payment failures, grace periods, suspension, and eventual termination. This process is managed by on-ledger Daml smart contracts to ensure atomicity, transparency, and automated enforcement.

## 1. Core States

A subscription contract can exist in one of the following states, which dictates service access and billing actions.

| State | Description | Service Access |
| :--- | :--- | :--- |
| **Active** | The subscription is in good standing. All invoices are paid. | **Enabled** |
| **PastDue** | The most recent payment failed. The subscription is in a grace period. | **Enabled** |
| **Suspended** | The grace period expired without payment. | **Disabled** |
| **Terminated** | The subscription has been permanently closed due to non-payment. | **Disabled** |
| **Cancelled** | The subscription has been cancelled by the user. | **Disabled** |

## 2. Standard Billing Cycle

- **Period**: Billing occurs on a recurring monthly basis, calculated from the `startDate` of the `SubscriptionAgreement` contract.
- **Invoice Generation**: An `Invoice` contract is created on the ledger at the beginning of each billing cycle (e.g., on the 15th of each month if the subscription started on the 15th).
- **Payment Attempt**: Immediately and atomically upon invoice creation, the billing engine attempts to pull the invoiced amount from the subscriber's pre-authorized payment method.
- **Success**: If the payment succeeds, the `Invoice` is marked as `Paid`, and the `SubscriptionAgreement` remains `Active`.
- **Failure**: If the payment fails, the `Invoice` is marked as `Unpaid`, and the Dunning Process (see below) begins.

## 3. Dunning & Failure Handling Process

The dunning process is the automated sequence of actions taken in response to a failed payment. The timeline is relative to the date of the initial failed payment attempt (`T+0`).

### Step 1: Initial Failure & Grace Period Start (`T+0`)

- The initial automated payment attempt fails.
- The `SubscriptionAgreement` state transitions from `Active` to `PastDue`.
- The **14-day grace period** begins.
- The subscriber is notified of the payment failure and the start of the grace period.
- Service access remains **enabled** during the grace period.

### Step 2: Payment Retries

Automated payment retries are scheduled within the grace period to maximize the chance of recovery.

- **Retry 1 (`T + 3 days`)**: The system makes a second attempt to process the payment for the outstanding invoice.
- **Retry 2 (`T + 7 days`)**: The system makes a third attempt.
- **Retry 3 (`T + 13 days`)**: The final automated attempt is made before the grace period expires.

If any retry attempt is successful, the `Invoice` is marked `Paid`, the `SubscriptionAgreement` state reverts to `Active`, and the dunning process for that invoice is terminated.

### Step 3: Service Suspension (`T + 14 days`)

- If the grace period ends and the invoice remains unpaid, the subscription is suspended.
- The `SubscriptionAgreement` state transitions from `PastDue` to `Suspended`.
- Service access is **disabled**. Off-ledger systems consuming the ledger state will enforce this access change.
- The subscriber is notified of the service suspension.
- The subscription will remain in the `Suspended` state for **30 days**.

### Step 4: Reactivation from Suspension

- During the 30-day suspension period, the subscriber can manually trigger a payment for all outstanding invoices.
- If payment is successful, the `SubscriptionAgreement` state transitions back to `Active`, and service access is immediately restored.

### Step 5: Termination (`T + 44 days`)

- If the subscription remains in the `Suspended` state for the full 30-day suspension period (`T+14` grace + `T+30` suspension), it is automatically and permanently terminated.
- The `SubscriptionAgreement` state transitions to `Terminated`, and the contract is archived.
- This action is **irreversible**.
- Any outstanding `Invoice` contracts are archived and marked as written off in an accounting system.
- To regain service access, the user must create a new subscription.

## 4. Lifecycle Summary Timeline

![Billing Lifecycle Timeline](https://via.placeholder.com/1200x200.png?text=T%2B0%3A%20Fail%20-%3E%20T%2B14%3A%20Suspend%20-%3E%20T%2B44%3A%20Terminate)

| Day | Event | State | Service Access |
| :--- | :--- | :--- | :--- |
| **T+0** | Initial Payment Fails | `PastDue` | **Enabled** |
| T+1 | - | `PastDue` | **Enabled** |
| T+3 | Retry #1 | `PastDue` | **Enabled** |
| T+7 | Retry #2 | `PastDue` | **Enabled** |
| T+13 | Retry #3 | `PastDue` | **Enabled** |
| **T+14** | Grace Period Ends | `Suspended` | **Disabled** |
| T+15..43 | - | `Suspended` | **Disabled** |
| **T+44** | Suspension Period Ends | `Terminated` | **Disabled** |

## 5. Service Level Agreements (SLAs)

- **Invoice Generation**: Invoices for a new billing period will be generated on-ledger within 1 hour of the cycle start time (00:00 UTC on the billing day).
- **Payment Attempt**: The initial payment attempt will be executed atomically with invoice creation.
- **State Transitions**: All state transitions (`Active` -> `PastDue`, `PastDue` -> `Suspended`, etc.) are guaranteed by the Daml ledger to be atomic and consistent with the rules defined in the smart contracts. There is no risk of a payment being processed without the subscription state being updated correctly.
- **Notification Delivery**: Notifications for state changes and payment events will be dispatched to an off-ledger notification service within 5 minutes of the on-ledger transaction being committed. Final delivery depends on the external service provider.