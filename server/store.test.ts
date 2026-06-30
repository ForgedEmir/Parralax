import { describe, expect, it } from "vitest";
import { fixtureFor, fixtureObservations } from "./fixtures.js";
import { protocolTemplates } from "./protocols.js";
import { OperationStore } from "./store.js";

describe("operation state machine", () => {
  it("executes hold, repair dispatch, correction, and release", () => {
    const store = new OperationStore();

    store.setInspecting();
    const held = store.applyInspection({
      observation: fixtureObservations.mismatch,
      source: "fixture",
      fixture: "mismatch",
      imageUrl: "/evidence/package-mismatch.png",
    });

    expect(held.status).toBe("HELD");
    expect(held.actions.map((action) => action.type)).toEqual([
      "NOTIFY_OPERATOR",
      "CREATE_CORRECTION_TASK",
      "HOLD_ORDER",
    ]);
    expect(held.repair?.status).toBe("OPEN");
    expect(held.repair?.steps).toHaveLength(2);
    expect(held.metrics).toEqual({
      autonomousActions: 3,
      preventedErrors: 1,
      valueProtected: 84.5,
    });

    store.setInspecting();
    const released = store.applyInspection({
      observation: fixtureObservations.corrected,
      source: "fixture",
      fixture: "corrected",
      imageUrl: "/evidence/package-corrected.png",
    });

    expect(released.status).toBe("RELEASED");
    expect(released.actions.map((action) => action.type)).toEqual([
      "UPDATE_INVENTORY",
      "RELEASE_ORDER",
      "NOTIFY_OPERATOR",
      "CREATE_CORRECTION_TASK",
      "HOLD_ORDER",
    ]);
    expect(released.repair?.status).toBe("RESOLVED");
    expect(released.repair?.steps.every((step) => step.completed)).toBe(true);
    expect(released.metrics.autonomousActions).toBe(5);
    expect(released.releasedAt).toBeDefined();
    expect(released.evidenceHistory).toHaveLength(2);
    expect(released.evidenceHistory.map((record) => record.decision)).toEqual(["HELD", "RELEASED"]);
    expect(released.evidenceHistory.every((record) => record.ledgerHash.length === 64)).toBe(true);
    expect(released.evidenceHistory[0].evidence.digest).not.toBe(released.evidenceHistory[1].evidence.digest);
  });

  it("takes no operational action on insufficient evidence", () => {
    const store = new OperationStore();
    store.setInspecting();
    const state = store.applyInspection({
      observation: fixtureObservations.unclear,
      source: "fixture",
      fixture: "unclear",
      imageUrl: "/evidence/package-mismatch.png",
    });

    expect(state.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(state.actions).toHaveLength(0);
    expect(state.repair).toBeUndefined();
    expect(state.metrics.autonomousActions).toBe(0);
  });

  it("compiles a reusable protocol and records Hermes provenance", () => {
    const store = new OperationStore();
    const state = store.compile(protocolTemplates[1], "hermes");

    expect(state.id).toBe("FS-8891");
    expect(state.protocol.domain).toBe("Field service");
    expect(state.manifest).toHaveLength(3);
    expect(state.events[0].actor).toBe("hermes");
    expect(state.ledger[0].event).toBe("PROTOCOL_COMPILED");
  });

  it("runs the same repair loop for a field-service protocol", () => {
    const store = new OperationStore();
    store.compile(protocolTemplates[1], "hermes");
    const mismatch = fixtureFor("field-service-closeout-v1", "mismatch");
    const corrected = fixtureFor("field-service-closeout-v1", "corrected");

    store.setInspecting("hermes");
    const held = store.applyInspection({
      observation: mismatch.observation,
      source: "fixture",
      fixture: "mismatch",
      imageUrl: mismatch.imageUrl,
      orchestrator: "hermes",
    });

    expect(held.status).toBe("HELD");
    expect(held.discrepancies.map((item) => item.sku)).toEqual([
      "SEAL-SAFETY-R",
      "LABEL-SERVICE",
    ]);
    expect(held.metrics.valueProtected).toBe(1250);

    store.setInspecting("hermes");
    const released = store.applyInspection({
      observation: corrected.observation,
      source: "fixture",
      fixture: "corrected",
      imageUrl: corrected.imageUrl,
      orchestrator: "hermes",
    });

    expect(released.status).toBe("RELEASED");
    expect(released.repair?.status).toBe("RESOLVED");
    expect(released.ledger.filter((entry) => entry.event === "ACTION_EXECUTED")).toHaveLength(5);
  });
  it("records Hermes inspection commands in the evidence ledger", () => {
    const store = new OperationStore();
    store.setInspecting("hermes");
    const state = store.get();

    expect(state.events.some((entry) => entry.actor === "hermes")).toBe(true);
    expect(state.ledger.map((entry) => entry.event)).toContain("HERMES_COMMAND");
  });
});
