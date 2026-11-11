## ADDED Requirements

### Requirement: Correct an income date using a verified employer payslip
The adapter SHALL permit an explicit payroll evidence alternative for a positive eligible historical income when one complete bank statement covers both dates and an independently inspected employer payslip for the same month identifies the employee, employer and matching advance. The operator SHALL verify the unique bank credit, its payer, amount and date, the historical record and the complete statement, and establish there is no other matching advance. The new date SHALL be one to four days later in the same month. The adapter SHALL require a distinct payslip Drive identifier, declared month and covering statement boundaries, and reject any other same-account equal-amount income in that month. All existing snapshot, payer, nearby duplicate, hash, lease, lock, backup, pending-audit and full independent verification safeguards SHALL apply.

#### Scenario: Unique payroll advance
- **WHEN** a complete covering statement and verified same-month payslip identify a unique eligible advance with a later posting date
- **THEN** the adapter previews and independently verifies only the date correction without creating an income.

#### Scenario: Ambiguous or insufficient evidence
- **WHEN** evidence is missing, the payslip month differs, another matching income exists in the same account and month, dates fall outside the statement, or the explicit mode conflicts with another evidence mode
- **THEN** no write occurs.
