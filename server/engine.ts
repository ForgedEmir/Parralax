import { createHash } from "node:crypto";
import type {
  Discrepancy,
  LedgerEntry,
  ManifestItem,
  Observation,
} from "../shared/types.js";

export const DEFAULT_MIN_CONFIDENCE = 0.72;

export interface ValidationResult {
  outcome: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";
  discrepancies: Discrepancy[];
}

const value = (input: string | number | undefined) =>
  input === undefined ? "not observed" : String(input);

export function validateObservation(
  manifest: ManifestItem[],
  observation: Observation,
  minimumConfidence = DEFAULT_MIN_CONFIDENCE,
): ValidationResult {
  if (observation.evidenceConfidence < minimumConfidence) {
    return { outcome: "INSUFFICIENT_EVIDENCE", discrepancies: [] };
  }

  const discrepancies: Discrepancy[] = [];
  const expectedSkus = new Set(manifest.map((item) => item.sku));

  for (const expected of manifest) {
    const observed = observation.items.find((item) => item.sku === expected.sku);

    if (!observed) {
      discrepancies.push({
        id: `missing-${expected.sku}`,
        type: "MISSING_ITEM",
        sku: expected.sku,
        label: expected.label,
        expected: `${expected.quantity} required`,
        observed: "not detected",
        severity: "critical",
      });
      continue;
    }

    if (observed.quantity !== expected.quantity) {
      discrepancies.push({
        id: `quantity-${expected.sku}`,
        type: "QUANTITY_MISMATCH",
        sku: expected.sku,
        label: expected.label,
        expected: value(expected.quantity),
        observed: value(observed.quantity),
        severity: "critical",
      });
    }

    if (
      expected.color &&
      observed.color?.toLocaleLowerCase() !== expected.color.toLocaleLowerCase()
    ) {
      discrepancies.push({
        id: `attribute-${expected.sku}-color`,
        type: "ATTRIBUTE_MISMATCH",
        sku: expected.sku,
        label: `${expected.label} / color`,
        expected: expected.color,
        observed: value(observed.color),
        severity: "critical",
      });
    }

    if (
      expected.condition &&
      observed.condition?.toLocaleLowerCase() !== expected.condition.toLocaleLowerCase()
    ) {
      discrepancies.push({
        id: `condition-${expected.sku}`,
        type: "CONDITION_MISMATCH",
        sku: expected.sku,
        label: `${expected.label} / condition`,
        expected: expected.condition,
        observed: value(observed.condition),
        severity: "critical",
      });
    }
  }

  for (const observed of observation.items) {
    if (!expectedSkus.has(observed.sku)) {
      discrepancies.push({
        id: `unexpected-${observed.sku}`,
        type: "UNEXPECTED_ITEM",
        sku: observed.sku,
        label: observed.label,
        expected: "not in manifest",
        observed: `${observed.quantity} detected`,
        severity: "warning",
      });
    }
  }

  return {
    outcome: discrepancies.length === 0 ? "PASS" : "FAIL",
    discrepancies,
  };
}

const digest = (valueToHash: unknown) =>
  createHash("sha256").update(JSON.stringify(valueToHash)).digest("hex");

export function appendLedgerEntry(
  ledger: LedgerEntry[],
  event: string,
  payload: unknown,
  timestamp = new Date().toISOString(),
): LedgerEntry {
  const previousHash = ledger.at(-1)?.hash ?? "GENESIS";
  const payloadDigest = digest(payload);
  const sequence = ledger.length + 1;
  const hash = digest({ sequence, timestamp, event, payloadDigest, previousHash });
  return { sequence, timestamp, event, payloadDigest, previousHash, hash };
}

export function verifyLedger(ledger: LedgerEntry[]): boolean {
  return ledger.every((entry, index) => {
    const previousHash = index === 0 ? "GENESIS" : ledger[index - 1].hash;
    if (entry.previousHash !== previousHash || entry.sequence !== index + 1) return false;
    return (
      entry.hash ===
      digest({
        sequence: entry.sequence,
        timestamp: entry.timestamp,
        event: entry.event,
        payloadDigest: entry.payloadDigest,
        previousHash: entry.previousHash,
      })
    );
  });
}

export function sha256(valueToHash: string | Buffer): string {
  return createHash("sha256").update(valueToHash).digest("hex");
}
