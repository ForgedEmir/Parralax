import { describe, expect, it } from "vitest";
import { appendLedgerEntry, validateObservation, verifyLedger } from "./engine.js";
import { fixtureObservations } from "./fixtures.js";

const manifest = [
  { sku: "MUG-RED-01", label: "Ceramic mug", quantity: 1, color: "red", condition: "intact" },
  { sku: "CBL-USBC-2M", label: "USB-C cable", quantity: 1, color: "black" },
  { sku: "DOC-WARRANTY", label: "Warranty card", quantity: 1, color: "white" },
];

describe("deterministic reconciliation", () => {
  it("holds a package with a wrong attribute and a missing item", () => {
    const result = validateObservation(manifest, fixtureObservations.mismatch);
    expect(result.outcome).toBe("FAIL");
    expect(result.discrepancies.map((item) => item.type)).toEqual([
      "ATTRIBUTE_MISMATCH",
      "MISSING_ITEM",
    ]);
  });

  it("blocks a complete package when a product is visibly damaged", () => {
    const result = validateObservation(manifest, fixtureObservations.damaged);
    expect(result.outcome).toBe("FAIL");
    expect(result.discrepancies).toEqual([
      expect.objectContaining({ type: "CONDITION_MISMATCH", observed: "damaged", expected: "intact" }),
    ]);
  });

  it("releases only when every invariant passes", () => {
    expect(validateObservation(manifest, fixtureObservations.corrected)).toEqual({
      outcome: "PASS",
      discrepancies: [],
    });
  });

  it("refuses low-confidence evidence without inventing discrepancies", () => {
    expect(validateObservation(manifest, fixtureObservations.unclear)).toEqual({
      outcome: "INSUFFICIENT_EVIDENCE",
      discrepancies: [],
    });
  });
});

describe("evidence ledger", () => {
  it("verifies an intact chain and rejects tampering", () => {
    const first = appendLedgerEntry([], "ORDER_CREATED", { order: "PX-1" });
    const second = appendLedgerEntry([first], "ORDER_HELD", { reason: "mismatch" });
    expect(verifyLedger([first, second])).toBe(true);
    expect(verifyLedger([{ ...first, event: "ORDER_RELEASED" }, second])).toBe(false);
  });
});
