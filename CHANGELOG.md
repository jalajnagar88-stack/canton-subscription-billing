# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Core subscription agreement and invoice templates.
- Daml Triggers for automated billing and payment enforcement.
- Grace period and service suspension logic.
- Integration with a CIP-0056 compliant token for payments.

### Changed
- ...

### Fixed
- ...

## [0.1.0] - 2024-07-26

### Added
- Initial project structure with `daml.yaml` and `.gitignore`.
- `Subscription.Cancellation` Daml module, defining the two-step workflow for a subscriber to request cancellation and a provider to confirm it.
- `CancellationRequest` template representing the subscriber's intent to terminate the service.
- `CancellationConfirmation` template representing the provider's acknowledgement.
- Daml Script tests in `daml/test/CancellationTest.daml` to validate the happy path and failure scenarios for the cancellation workflow.
- A placeholder React component `frontend/src/InvoiceList.tsx` for the future user interface.
- Project `README.md` outlining the project goals and setup instructions.
- This `CHANGELOG.md` to track project evolution.