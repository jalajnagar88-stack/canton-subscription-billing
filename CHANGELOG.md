# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `daml/Cancellation.daml`: New Daml templates and choices to handle mutual subscription cancellation requests and confirmations. This includes `SubscriptionCancellationProposal` and the `AcknowledgeCancellation` choice on the main `Subscription` contract.
- `daml/test/CancellationTest.daml`: Daml Script tests covering the full cancellation lifecycle, including proposals from both subscriber and provider.
- `frontend/src/InvoiceList.tsx`: A new React component to fetch and display a list of historical and outstanding invoices for a subscriber.

## [0.2.0] - 2024-05-15

### Added
- Grace period and service suspension logic. If an invoice payment fails, the subscription now enters a `GracePeriod` status.
- `SuspendService` choice on the `Subscription` contract, which transitions the status to `Suspended` after the grace period expires.
- `Terminate` choice to permanently end a suspended contract.
- `daml/test/SuspensionTest.daml`: New tests to validate the payment failure, grace period, suspension, and termination flow.

### Changed
- The `Subscription` template now includes a `status` field, which can be `Active`, `GracePeriod`, `Suspended`, or `Terminated`.
- The `ProcessBillingCycle` choice now checks the subscription status and will not generate new invoices for `Suspended` or `Terminated` subscriptions.

## [0.1.0] - 2024-04-28

### Added
- Initial project setup with `daml.yaml` configured for Daml SDK 3.1.0.
- `README.md` with project description and setup instructions.
- `docs/BILLING_SPEC.md` outlining the core requirements for the billing system.
- `daml/Subscription.daml`: Core `Subscription` template representing the agreement between a `provider` and `subscriber`.
- `daml/Invoice.daml`: `Invoice` and `PaidInvoice` templates for tracking billing periods and payments.
- `daml/Billing.daml`: `BillingEngine` contract with logic to trigger periodic billing cycles via the `ProcessBillingCycle` choice.
- `daml/Roles.daml`: `ProviderRole` and `SubscriberRole` templates for managing on-ledger party relationships.
- `daml/test/BillingTest.daml`: Initial Daml Script tests for the subscription creation and successful payment "happy path".
- Basic `.gitignore` and GitHub Actions CI workflow for `daml build` and `daml test`.