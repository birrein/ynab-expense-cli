# actual-dated-split-purchase-refund Specification

## Purpose
Preserve bank dates, receipt categories and transparent proportional allocation for a purchase with a later global refund.

## Requirements

### Requirement: Register a verified split purchase and refund
The adapter SHALL accept only an evidenced same-account split purchase and separately settled global refund with disjoint sources and exact category allocations. It SHALL require a receipt-backed final amount by category, proportional discount allocation explicitly identified as an estimate, valid dates, unique categories and sources, exact parent and child sums, and no conflicting existing transactions or source ownership. A run lease, lock, full backup, pre-write revalidation and durable pending intent SHALL precede financial writes. The adapter SHALL synchronize and independently verify both linked parents and children, all previous transactions and balances before completing the audit and ledger. An interrupted operation SHALL stop for investigation; an exact completed retry SHALL verify without writing.

#### Scenario: Purchase and global refund on different dates
- **WHEN** receipt categories, initial bank charge and later refund are independently verified
- **THEN** the adapter creates one negative split on the purchase date and one linked positive split on the refund date, leaving each net category equal to the receipt.

#### Scenario: Conflicting evidence, amount or source
- **WHEN** any source is reused, amount is unbalanced, allocation is not proportional, or a possible duplicate exists
- **THEN** no financial write occurs.

#### Scenario: Partial or repeated operation
- **WHEN** a pending operation is incomplete or the identical completed operation is retried
- **THEN** the pending operation stops for investigation and the completed operation performs no new writes.
