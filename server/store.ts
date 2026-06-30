import { randomUUID } from "node:crypto";
import type {
  AutomatedAction,
  AutomatedActionType,
  Discrepancy,
  EventTone,
  FixtureId,
  Observation,
  OperationDefinition,
  OperationEvent,
  Orchestrator,
  OrderState,
  RepairDirective,
} from "../shared/types.js";
import { appendLedgerEntry, sha256, validateObservation } from "./engine.js";

import { defaultOperation } from "./protocols.js";

const now = () => new Date().toISOString();

function event(
  title: string,
  detail: string,
  actor: OperationEvent["actor"],
  tone: EventTone,
): OperationEvent {
  return { id: randomUUID(), timestamp: now(), title, detail, actor, tone };
}

function correctionLabel(discrepancy: Discrepancy): string {
  switch (discrepancy.type) {
    case "MISSING_ITEM":
      return `Add ${discrepancy.label} (${discrepancy.expected})`;
    case "UNEXPECTED_ITEM":
      return `Remove unexpected ${discrepancy.label}`;
    case "QUANTITY_MISMATCH":
      return `Adjust ${discrepancy.label}: ${discrepancy.observed} -> ${discrepancy.expected}`;
    case "ATTRIBUTE_MISMATCH":
      return `Replace ${discrepancy.label}: ${discrepancy.observed} -> ${discrepancy.expected}`;
    case "CONDITION_MISMATCH":
      return `Replace damaged ${discrepancy.label}: ${discrepancy.observed} -> ${discrepancy.expected}`;
  }
}

function buildRepairDirective(discrepancies: Discrepancy[], timestamp: string): RepairDirective {
  return {
    id: randomUUID(),
    title: "Restore protocol parity",
    summary: `${discrepancies.length} physical corrections required before automatic re-verification.`,
    status: "OPEN",
    createdAt: timestamp,
    steps: discrepancies.map((discrepancy) => ({
      id: discrepancy.id,
      label: correctionLabel(discrepancy),
      completed: false,
    })),
  };
}

export function createInitialState(definition: OperationDefinition = defaultOperation): OrderState {
  const createdAt = now();
  const state: OrderState = {
    id: definition.operationId,
    station: definition.station,
    destination: definition.destination,
    protocol: structuredClone(definition.protocol),
    status: "AWAITING_EVIDENCE",
    revision: 1,
    manifest: structuredClone(definition.manifest),
    discrepancies: [],
    metrics: {
      autonomousActions: 0,
      preventedErrors: 0,
      valueProtected: 0,
    },
    actions: [],
    evidenceHistory: [],
    events: [
      {
        id: randomUUID(),
        timestamp: createdAt,
        title: "Protocol armed",
        detail: `${definition.manifest.length} invariants loaded from ${definition.protocol.name}.`,
        actor: "system",
        tone: "neutral",
      },
    ],
    ledger: [],
  };
  state.ledger.push(
    appendLedgerEntry(
      [],
      "OPERATION_CREATED",
      { operationId: state.id, protocol: state.protocol.id },
      createdAt,
    ),
  );
  return state;
}

export class OperationStore {
  private state = createInitialState();
  private listeners = new Set<(state: OrderState) => void>();

  get(): OrderState {
    return structuredClone(this.state);
  }

  reset(orchestrator: Orchestrator = "dashboard"): OrderState {
    this.state = createInitialState();
    if (orchestrator === "hermes") {
      this.state.events.unshift(
        event(
          "Hermes initialized operation",
          "Agent reset the active run and requested fresh physical evidence.",
          "hermes",
          "info",
        ),
      );
      this.record("HERMES_COMMAND", { command: "reset_operation" });
    }
    this.publish();
    return this.get();
  }

  compile(definition: OperationDefinition, orchestrator: Orchestrator = "dashboard"): OrderState {
    this.state = createInitialState(definition);
    const actor = orchestrator === "hermes" ? "hermes" : "operator";
    this.state.events[0] = event(
      "Operation protocol compiled",
      `${definition.protocol.name} is active with ${definition.manifest.length} deterministic invariants.`,
      actor,
      "info",
    );
    this.state.ledger = [
      appendLedgerEntry(
        [],
        "PROTOCOL_COMPILED",
        { definition, orchestrator },
        this.state.events[0].timestamp,
      ),
    ];
    this.publish();
    return this.get();
  }

  setInspecting(orchestrator: Orchestrator = "dashboard"): OrderState {
    this.state.status = "INSPECTING";
    this.state.revision += 1;
    if (orchestrator === "hermes") {
      this.state.events.unshift(
        event(
          "Hermes dispatched inspection",
          "Agent selected the evidence source and invoked deterministic reconciliation.",
          "hermes",
          "info",
        ),
      );
      this.record("HERMES_COMMAND", { command: "inspect_evidence", revision: this.state.revision });
    }
    this.state.events.unshift(
      event(
        "Evidence received",
        "The vision adapter is extracting a structured observation.",
        "vision",
        "info",
      ),
    );
    this.record("EVIDENCE_RECEIVED", { revision: this.state.revision, orchestrator });
    this.publish();
    return this.get();
  }

  applyInspection(input: {
    observation: Observation;
    source: "fixture" | "upload" | "video";
    imageUrl: string;
    fixture?: FixtureId;
    imageDigest?: string;
    mediaType?: "image" | "video";
    frameCount?: number;
    orchestrator?: Orchestrator;
  }): OrderState {
    const timestamp = now();
    const orchestrator = input.orchestrator ?? "dashboard";
    const evidenceDigest = input.imageDigest ?? sha256(input.imageUrl);
    const validation = validateObservation(
      this.state.manifest,
      input.observation,
      Number(process.env.MIN_EVIDENCE_CONFIDENCE ?? 0.72),
    );

    this.state.evidence = {
      id: randomUUID(),
      imageUrl: input.imageUrl,
      source: input.source,
      fixture: input.fixture,
      capturedAt: timestamp,
      digest: evidenceDigest,
      mediaType: input.mediaType ?? "image",
      frameCount: input.frameCount,
    };
    this.state.observation = input.observation;
    this.state.discrepancies = validation.discrepancies;
    this.state.revision += 1;

    if (validation.outcome === "INSUFFICIENT_EVIDENCE") {
      this.state.status = "INSUFFICIENT_EVIDENCE";
      this.state.events.unshift(
        event(
          "Evidence refused",
          "Confidence is below policy threshold. No operational action was taken.",
          "policy",
          "warning",
        ),
      );
      this.record("EVIDENCE_REFUSED", { confidence: input.observation.evidenceConfidence });
    } else if (validation.outcome === "FAIL") {
      const opensNewIncident = this.state.repair?.status !== "OPEN";
      this.state.status = "HELD";
      this.state.repair = buildRepairDirective(validation.discrepancies, timestamp);
      this.state.events.unshift(
        event(
          "Order held automatically",
          `${validation.discrepancies.length} protocol violations blocked the workflow.`,
          "policy",
          "danger",
        ),
      );
      this.state.events.unshift(
        event(
          "Correction task dispatched",
          this.state.repair.summary,
          orchestrator === "hermes" ? "hermes" : "system",
          "warning",
        ),
      );
      this.pushAction("HOLD_ORDER", "Fulfillment hold applied");
      this.pushAction("CREATE_CORRECTION_TASK", "Structured correction task opened");
      this.pushAction("NOTIFY_OPERATOR", "Mobile operator notification dispatched");
      if (opensNewIncident) {
        this.state.metrics.preventedErrors += 1;
        this.state.metrics.valueProtected += this.state.protocol.valueAtRisk;
      }
      this.record("ORDER_HELD", {
        discrepancies: validation.discrepancies,
        repair: this.state.repair,
      });
    } else {
      if (this.state.repair?.status === "OPEN") {
        this.state.repair.status = "RESOLVED";
        this.state.repair.resolvedAt = timestamp;
        this.state.repair.steps = this.state.repair.steps.map((step) => ({
          ...step,
          completed: true,
        }));
        this.state.events.unshift(
          event(
            "Repair loop closed",
            "Every correction step is now supported by fresh visual evidence.",
            orchestrator === "hermes" ? "hermes" : "system",
            "success",
          ),
        );
        this.record("REPAIR_RESOLVED", { repairId: this.state.repair.id });
      }
      this.state.status = "RELEASED";
      this.state.releasedAt = timestamp;
      this.state.events.unshift(
        event(
          "Reality reconciled",
          "Evidence matches every protocol invariant. The workflow may continue.",
          "policy",
          "success",
        ),
      );
      this.pushAction("RELEASE_ORDER", "Fulfillment hold released");
      this.pushAction("UPDATE_INVENTORY", "Inventory movement committed");
      this.record("ORDER_RELEASED", {
        evidenceDigest,
        protocol: this.state.protocol.id,
        manifest: this.state.manifest,
      });
    }

    const evidence = this.state.evidence;
    this.record("EVIDENCE_SNAPSHOT_COMMITTED", {
      evidenceId: evidence.id,
      digest: evidence.digest,
      decision: this.state.status,
      discrepancyCount: this.state.discrepancies.length,
    });
    this.state.evidenceHistory.push({
      id: randomUUID(),
      sequence: this.state.evidenceHistory.length + 1,
      evidence: structuredClone(evidence),
      observation: structuredClone(input.observation),
      decision: this.state.status as "HELD" | "RELEASED" | "INSUFFICIENT_EVIDENCE",
      discrepancies: structuredClone(this.state.discrepancies),
      ledgerHash: this.state.ledger.at(-1)!.hash,
    });

    this.publish();
    return this.get();
  }

  subscribe(listener: (state: OrderState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private pushAction(type: AutomatedActionType, label: string) {
    const duplicate = this.state.actions.some((action) => action.type === type);
    if (duplicate) return;
    const action: AutomatedAction = {
      id: randomUUID(),
      type,
      label,
      target: actionTarget(type),
      receipt: `px_${sha256(`${this.state.id}:${type}`).slice(0, 12)}`,
      status: "executed",
      timestamp: now(),
    };
    this.state.actions.unshift(action);
    this.state.metrics.autonomousActions += 1;
    this.record("ACTION_EXECUTED", action);
  }

  private record(eventName: string, payload: unknown) {
    this.state.ledger.push(appendLedgerEntry(this.state.ledger, eventName, payload));
  }

  private publish() {
    const snapshot = this.get();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function actionTarget(type: AutomatedActionType): string {
  if (type === "NOTIFY_OPERATOR") return "Mobile gateway";
  if (type === "CREATE_CORRECTION_TASK") return "Work order system";
  if (type === "UPDATE_INVENTORY") return "System of record";
  return "Workflow controller";
}
