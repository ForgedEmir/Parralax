import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchNewActions } from "./actions.js";
import { fixtureObservations } from "./fixtures.js";
import { OperationStore } from "./store.js";

afterEach(() => {
  delete process.env.ACTION_WEBHOOK_URL;
  delete process.env.ACTION_WEBHOOK_SECRET;
  vi.unstubAllGlobals();
});

describe("action outbox", () => {
  it("delivers every new action with idempotency and HMAC headers", async () => {
    process.env.ACTION_WEBHOOK_URL = "https://operations.example/actions";
    process.env.ACTION_WEBHOOK_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = new OperationStore();
    const before = new Set(store.get().actions.map((action) => action.id));
    store.setInspecting("hermes");
    const held = store.applyInspection({
      observation: fixtureObservations.mismatch,
      source: "fixture",
      fixture: "mismatch",
      imageUrl: "/evidence/package-mismatch.png",
      orchestrator: "hermes",
    });

    const summary = await dispatchNewActions(held, before);

    expect(summary).toEqual({ mode: "webhook", attempted: 3, delivered: 3, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers["Idempotency-Key"]).toMatch(/^px_[a-f0-9]{12}$/);
      expect(init.headers["X-Parallax-Signature"]).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
