# actual-owned-split-child-note Specification

## Purpose
Keep descriptions on verified split children accurate without changing financial identity, values or sources.

## Requirements

### Requirement: Amend one verified child description
Direct split child note updates SHALL be disabled until a safe approach is implemented and independently verified against Actual. The adapter SHALL reject the operation before accessing the API or changing any transaction.

#### Scenario: Direct child note update requested
- **WHEN** a split child note update is requested
- **THEN** the adapter rejects it without writing.

#### Scenario: One stale child note
- **WHEN** the verified child has a stale description
- **THEN** the adapter rejects a direct child update without writing.

#### Scenario: Unsafe or repeated operation
- **WHEN** the operation is unsafe or repeated
- **THEN** the adapter rejects a direct child update without writing.
