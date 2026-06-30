# PARALLAX Use-Case Map

PARALLAX is a protocol-scoped visual transaction layer: software declares what must be physically true, multimodal evidence reports what is visible, deterministic policy decides, and Hermes executes the allowed business action.

## Demo-ready protocols

| Workflow | Digital claim | Visual proof | Autonomous action |
| --- | --- | --- | --- |
| Fulfillment pack-out | Correct SKU, quantity, color, and intact condition | Multi-angle package photos or a short video sweep | Hold shipment, create replacement task, notify, recheck, release, update inventory |
| HVAC closeout | Filter, safety seal, and service label installed | Cabinet overview plus side angle | Block visit closeout, assign correction, recheck, close work order |
| Retail planogram | Required product facings and promo tag present | Frontal and oblique shelf views | Open restock task, notify store associate, approve shelf reset |

## Highest-value next protocols

### 1. Returns and reverse logistics

- Claim: returned product matches serial and declared condition.
- Evidence: unboxing video, all-side product sweep, close-ups of seals and damage.
- Decision: accept, reject, or route to manual grading.
- Action: issue refund, create refurbishment task, or open dispute.
- Why strong: condition grading directly controls money and fraud exposure.

### 2. Proof of delivery

- Claim: parcel reached the correct destination intact.
- Evidence: package condition, doorway/address cues, timestamped drop-off sequence.
- Decision: delivery proven, damaged, ambiguous, or wrong location.
- Action: complete delivery, trigger reattempt, or open claim.
- Why strong: combines image history, video, condition, and business execution.

### 3. Rental and fleet handoff

- Claim: vehicle or equipment left and returned in the agreed condition.
- Evidence: repeatable walk-around video with all sides and asset identifier.
- Decision: unchanged, new damage, missing accessory, or insufficient coverage.
- Action: release deposit, create damage estimate, or request another capture.
- Why strong: temporal comparison is the product, not an add-on.

### 4. Manufacturing quality gate

- Claim: assembled unit matches the work instruction and has no visible defect.
- Evidence: fixed-camera inspection plus close-up defect views.
- Decision: pass, quarantine, rework, or human review.
- Action: release batch, stop line, create rework ticket.
- Why strong: NVIDIA already positions vision AI for automated defect inspection.

### 5. Construction installation closeout

- Claim: required components, fasteners, labels, and protective covers are installed.
- Evidence: wide context shot plus prescribed close-up angles.
- Decision: close milestone or create punch-list item.
- Action: approve contractor payment milestone or hold it.
- Why strong: costly physical rework and disputed completion are common.

### 6. Food and order assembly

- Claim: all items, variants, labels, and tamper seal are present.
- Evidence: packing-station image or short closing sequence.
- Decision: dispatch, repair, or refuse unclear evidence.
- Action: release courier pickup or create correction task.
- Boundary: this is order-completeness tooling, not food-safety certification.

## Evidence architecture

1. A protocol defines quantity, color, condition, required labels, and minimum confidence.
2. Photo, multi-angle burst, or video frames become structured visible facts.
3. The model reports observations; it never authorizes the business action.
4. Deterministic policy emits PASS, BLOCK, or RETAKE.
5. Hermes executes idempotent side effects.
6. Every consequential image remains in evidenceHistory with its image digest and ledger hash.
7. A later replacement never overwrites the original damage evidence.

## Damage-detection boundaries

- Damage must be visible and described by a protocol condition such as intact.
- Multiple angles or video frames reduce occlusion risk.
- Low confidence must return RETAKE, not PASS.
- Fine-grained industrial defects should use a specialized detector alongside the VLM.
- PARALLAX is not a safety certification system; it is an accountable workflow gate.

## Video path

The mobile client extracts four evenly spaced frames from a short clip and sends them as ordered multimodal evidence. This works with the existing OpenAI-compatible image pipeline. A production NVIDIA deployment can additionally send native MP4 input to Nemotron 3 Nano Omni or use NVIDIA VSS for tracking, long video, and multi-camera streams.