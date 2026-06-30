import { createHmac } from "node:crypto";
import type { AutomatedAction, OrderState } from "../shared/types.js";

export interface ActionDispatchSummary {
  mode: "local" | "webhook";
  attempted: number;
  delivered: number;
  failed: number;
}

const signatureFor = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("hex");

async function deliverAction(
  url: string,
  secret: string | undefined,
  state: OrderState,
  action: AutomatedAction,
) {
  const body = JSON.stringify({
    type: "parallax.operation.action",
    operationId: state.id,
    protocolId: state.protocol.id,
    status: state.status,
    action,
    evidenceDigest: state.evidence?.digest,
    ledgerHead: state.ledger.at(-1)?.hash,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": action.receipt,
    "X-Parallax-Event": action.type,
  };
  if (secret) headers["X-Parallax-Signature"] = signatureFor(body, secret);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Action webhook returned ${response.status}.`);
}

export async function dispatchNewActions(
  state: OrderState,
  previousActionIds: Set<string>,
): Promise<ActionDispatchSummary> {
  const actions = state.actions.filter((action) => !previousActionIds.has(action.id));
  const url = process.env.ACTION_WEBHOOK_URL;
  if (!url) {
    return { mode: "local", attempted: actions.length, delivered: actions.length, failed: 0 };
  }

  const results = await Promise.allSettled(
    actions.map((action) => deliverAction(url, process.env.ACTION_WEBHOOK_SECRET, state, action)),
  );
  const delivered = results.filter((result) => result.status === "fulfilled").length;
  return {
    mode: "webhook",
    attempted: actions.length,
    delivered,
    failed: actions.length - delivered,
  };
}
