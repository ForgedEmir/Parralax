---
name: parallax-protocol-compiler
description: Compile a physical business SOP or manifest into deterministic PARALLAX visual invariants, run evidence reconciliation, and verify the resulting action ledger.
---

# PARALLAX Protocol Compiler

Use this skill when a user wants Hermes to verify that a physical operation actually matches a digital SOP, manifest, checklist, work order, or planogram.

## Operating sequence

1. Call `list_protocols` and reuse a suitable template when possible.
2. Translate only visually verifiable requirements into manifest invariants.
3. Assign stable SKUs, explicit quantities, and visible attributes such as color.
4. Set `valueAtRisk` to the credible cost of an incorrect release.
5. Call `compile_operation`.
6. Inspect fresh evidence with `inspect_image`, or use `inspect_fixture` only for a declared demo.
7. If policy holds the operation, report the minimum correction steps exactly as returned.
8. Inspect fresh evidence after correction.
9. Call `verify_evidence_ledger` before reporting completion.

## Safety rules

- Never claim a fixture is live evidence.
- Never convert a subjective requirement into a deterministic invariant.
- Never release, pay, close, or update a system when evidence is below threshold.
- The vision model reports facts; PARALLAX policy owns the decision.
- Treat every action receipt and ledger head as evidence, not decoration.

## Good invariant examples

- one red tamper seal is visible across the service-panel boundary
- four blue product facings are visible on shelf 7
- one white warranty card is visible inside the package

## Bad invariant examples

- the installation looks professional
- the customer seems satisfied
- the machine is safe for all operating conditions