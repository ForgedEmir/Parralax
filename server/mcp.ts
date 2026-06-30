import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiBase = process.env.PARALLAX_API_URL ?? "http://127.0.0.1:8787";

async function api<T>(pathname: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("X-Parallax-Agent", "hermes");
  const response = await fetch(`${apiBase}${pathname}`, { ...init, headers });
  const body = await response.json();
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `PARALLAX API failed: ${response.status}`);
  }
  return body as T;
}

const result = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const server = new McpServer({ name: "parallax-operations", version: "0.2.0" });

server.registerTool(
  "get_operation",
  {
    description:
      "Read the active protocol, physical manifest, evidence, repair directive, business metrics, and executed actions.",
    inputSchema: {},
  },
  async () => result(await api("/api/order")),
);

server.registerTool(
  "list_protocols",
  {
    description:
      "List reusable operation protocol templates across warehouse, field service, and retail workflows.",
    inputSchema: {},
  },
  async () => result(await api("/api/protocols")),
);

server.registerTool(
  "compile_operation",
  {
    description:
      "Compile and activate a new visual operation protocol with deterministic physical invariants.",
    inputSchema: {
      operationId: z.string().min(3).max(80),
      station: z.string().min(2).max(80),
      destination: z.string().min(2).max(120),
      protocolId: z.string().min(3).max(80),
      protocolName: z.string().min(3).max(120),
      domain: z.string().min(2).max(80),
      objective: z.string().min(8).max(240),
      valueAtRisk: z.number().nonnegative().max(10_000_000),
      currency: z.string().length(3),
      manifest: z
        .array(
          z.object({
            sku: z.string().min(2).max(80),
            label: z.string().min(2).max(120),
            quantity: z.number().int().positive().max(10_000),
            color: z.string().min(2).max(40).optional(),
          }),
        )
        .min(1)
        .max(100),
    },
  },
  async ({
    operationId,
    station,
    destination,
    protocolId,
    protocolName,
    domain,
    objective,
    valueAtRisk,
    currency,
    manifest,
  }) =>
    result(
      await api("/api/order/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          station,
          destination,
          protocol: {
            id: protocolId,
            name: protocolName,
            version: "1.0",
            domain,
            objective,
            valueAtRisk,
            currency,
          },
          manifest,
        }),
      }),
    ),
);

server.registerTool(
  "inspect_fixture",
  {
    description:
      "Run one declared demo fixture through observation extraction, deterministic policy, and autonomous repair actions.",
    inputSchema: { fixture: z.enum(["mismatch", "corrected", "unclear", "mismatch-angle", "corrected-angle", "damaged", "replacement"]) },
  },
  async ({ fixture }) =>
    result(
      await api("/api/order/inspect-fixture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixture }),
      }),
    ),
);

server.registerTool(
  "inspect_image",
  {
    description:
      "Inspect a real local image with the configured open vision model, then execute hold, repair, or release actions.",
    inputSchema: {
      imagePath: z.string().describe("Absolute path to a JPEG, PNG, or WebP evidence image."),
    },
  },
  async ({ imagePath }) => {
    const bytes = await readFile(imagePath);
    const extension = path.extname(imagePath).toLowerCase();
    const mime =
      extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    const form = new FormData();
    form.set("evidence", new Blob([new Uint8Array(bytes)], { type: mime }), path.basename(imagePath));
    return result(await api("/api/order/inspect-upload", { method: "POST", body: form }));
  },
);

server.registerTool(
  "verify_evidence_ledger",
  {
    description: "Verify the complete hash-chained evidence and agent-action ledger.",
    inputSchema: {},
  },
  async () => result(await api("/api/order/ledger/verify")),
);

server.registerTool(
  "reset_operation",
  {
    description: "Reset the default demo operation and request fresh physical evidence.",
    inputSchema: {},
  },
  async () => result(await api("/api/order/reset", { method: "POST" })),
);

await server.connect(new StdioServerTransport());
