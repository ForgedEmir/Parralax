# Architecture

## Components

### Protocol Compiler

An operation definition contains protocol identity, domain, objective, value at risk, station, destination, and one to one hundred deterministic physical invariants. PARALLAX ships warehouse, field-service, and retail templates; Hermes can compile new definitions through MCP.

### Capture client

A mobile-first React surface captures an image from the phone's rear camera and associates it with the active operation.

### Hermes orchestrator

Hermes discovers seven stdio MCP tools, selects or compiles a protocol, dispatches inspections, reads repair directives, and verifies the evidence ledger. MCP writes carry agent provenance into the event stream and ledger.

### Vision adapter

Nemotron 3 Nano Omni analyzes evidence and returns a strict observation schema with items, quantities, attributes, confidence, and evidence notes. The adapter supports NVIDIA NIM, Hugging Face routing, or any OpenAI-compatible endpoint.

### Deterministic invariant engine

Code compares observations with the manifest. The model never decides whether an operation is held or released. Evidence below the confidence threshold cannot trigger side effects.

### Autonomous repair loop

A failed invariant set produces a structured correction directive. PARALLAX holds the workflow, opens a task, notifies the operator, waits for new evidence, then resolves the directive only when every invariant passes.

### Action adapters

The MVP executes five idempotent actions locally and can deliver each through an optional HMAC-signed webhook outbox:

- `hold_order`
- `create_correction_task`
- `notify_operator`
- `release_order`
- `update_inventory`

### Evidence ledger

Input hashes, Hermes commands, observations, policy decisions, repair transitions, and actions form a SHA-256 hash chain.

## State machine

```text
AWAITING_EVIDENCE
  -> INSPECTING
  -> INSUFFICIENT_EVIDENCE
  -> HELD + REPAIR_OPEN
  -> INSPECTING
  -> RELEASED + REPAIR_RESOLVED
```

## Trust boundary

The vision model perceives. Hermes orchestrates. Deterministic validators decide. Idempotent adapters own side effects. The ledger proves the complete sequence.
