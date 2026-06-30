import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { z } from "zod";
import type {
  FixtureId,
  Orchestrator,
  OperationDefinition,
  OrderState,
  RuntimeInfo,
} from "../shared/types.js";
import { dispatchNewActions } from "./actions.js";
import { sha256, verifyLedger } from "./engine.js";
import { demoReadyProtocols, fixtureFor } from "./fixtures.js";
import {
  operationDefinitionSchema,
  protocolTemplates,
} from "./protocols.js";
import { OperationStore } from "./store.js";
import { analyzeWithVision, learnManifestFromImage, visionMode, visionModel } from "./vision.js";

const slugify = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "ITEM";

const app = express();
const server = createServer(app);
const store = new OperationStore();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});
const burstUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 6 },
});
const port = Number(process.env.PORT ?? 8787);

const orchestratorFrom = (request: express.Request): Orchestrator =>
  request.get("X-Parallax-Agent") === "hermes" ? "hermes" : "dashboard";

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/runtime", (_request, response) => {
  const runtime: RuntimeInfo = {
    mode: visionMode(),
    visionModel: visionMode() === "demo" ? "Verified fixture replay" : visionModel(),
    hermesMcp: true,
    mcpTools: 7,
    actionAdapter: process.env.ACTION_WEBHOOK_URL ? "webhook" : "local",
    serverTime: new Date().toISOString(),
  };
  response.json(runtime);
});

app.get("/api/protocols", (_request, response) => {
  response.json(
    protocolTemplates.map((template) => ({
      ...template,
      invariantCount: template.manifest.length,
      demoReady: demoReadyProtocols.has(template.protocol.id),
    })),
  );
});

app.get("/api/order", (_request, response) => {
  response.json(store.get());
});

app.post("/api/order/reset", (request, response) => {
  response.json(store.reset(orchestratorFrom(request)));
});

app.post("/api/order/compile", (request, response, next) => {
  try {
    const definition = operationDefinitionSchema.parse(request.body);
    response.json(store.compile(definition, orchestratorFrom(request)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/order/ledger/verify", (_request, response) => {
  const ledger = store.get().ledger;
  response.json({ valid: verifyLedger(ledger), entries: ledger.length });
});

const fixtureRequest = z.object({
  fixture: z.enum(["mismatch", "corrected", "unclear", "mismatch-angle", "corrected-angle", "damaged", "replacement"]),
});

app.post("/api/order/inspect-fixture", async (request, response, next) => {
  try {
    const { fixture } = fixtureRequest.parse(request.body);
    const orchestrator = orchestratorFrom(request);
    const previousActionIds = new Set(store.get().actions.map((action) => action.id));
    store.setInspecting(orchestrator);
    await new Promise((resolve) => setTimeout(resolve, 650));
    const fixtureData = fixtureFor(store.get().protocol.id, fixture as FixtureId);
    const state = store.applyInspection({
      observation: fixtureData.observation,
      source: "fixture",
      fixture: fixture as FixtureId,
      imageUrl: fixtureData.imageUrl,
      orchestrator,
    });
    const dispatch = await dispatchNewActions(state, previousActionIds);
    response.json({ state, decision: state.status, dispatch });
  } catch (error) {
    next(error);
  }
});

app.post("/api/order/inspect-upload", upload.single("evidence"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "An evidence image is required." });
      return;
    }
    if (!request.file.mimetype.startsWith("image/")) {
      response.status(415).json({ error: "Only image evidence is supported in this MVP." });
      return;
    }
    if (visionMode() === "demo") {
      response.status(503).json({
        error:
          "Live vision is not configured. Use the fixture replay, set HF_TOKEN, or configure VISION_BASE_URL.",
      });
      return;
    }

    const orchestrator = orchestratorFrom(request);
    const previousActionIds = new Set(store.get().actions.map((action) => action.id));
    store.setInspecting(orchestrator);
    const imageDataUrl = `data:${request.file.mimetype};base64,${request.file.buffer.toString("base64")}`;
    const observation = await analyzeWithVision(imageDataUrl, store.get().manifest);
    const state = store.applyInspection({
      observation,
      source: "upload",
      imageUrl: imageDataUrl,
      imageDigest: sha256(request.file.buffer),
      orchestrator,
    });
    const dispatch = await dispatchNewActions(state, previousActionIds);
    response.json({ state, decision: state.status, dispatch });
  } catch (error) {
    next(error);
  }
});

app.post("/api/order/learn-reference", upload.single("evidence"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "A reference image is required." });
      return;
    }
    if (!request.file.mimetype.startsWith("image/")) {
      response.status(415).json({ error: "Only image evidence is supported in this MVP." });
      return;
    }
    if (visionMode() === "demo") {
      response.status(503).json({
        error:
          "Live vision is not configured. Set HF_TOKEN or VISION_BASE_URL to learn a reference photo.",
      });
      return;
    }

    const imageDataUrl = `data:${request.file.mimetype};base64,${request.file.buffer.toString("base64")}`;
    const learned = await learnManifestFromImage(imageDataUrl);
    if (!learned.items.length) {
      response.status(422).json({ error: "No reliable items were detected in the reference photo." });
      return;
    }

    const usedSkus = new Set<string>();
    const manifest = learned.items.map((item) => {
      let sku = `REF-${slugify(item.label)}`;
      let suffix = 1;
      while (usedSkus.has(sku)) {
        suffix += 1;
        sku = `REF-${slugify(item.label)}-${suffix}`;
      }
      usedSkus.add(sku);
      return { sku, label: item.label, quantity: item.quantity, color: item.color, condition: item.condition };
    });

    const orchestrator = orchestratorFrom(request);
    const definition: OperationDefinition = {
      operationId: `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
      station: "CUSTOM / REFERENCE",
      destination: "Custom scenario",
      protocol: {
        id: `custom-reference-${Date.now()}`,
        name: "Custom reference scenario",
        version: "1.0",
        domain: "Custom",
        objective: "Release only when fresh evidence matches the learned reference photo.",
        valueAtRisk: 100,
        currency: "EUR",
      },
      manifest,
    };
    const state = store.compile(definition, orchestrator);
    response.json({ state, learned });
  } catch (error) {
    next(error);
  }
});

app.post("/api/order/inspect-burst", burstUpload.array("frames", 6), async (request, response, next) => {
  try {
    const files = request.files as Express.Multer.File[];
    if (!files || files.length < 3) {
      response.status(400).json({ error: "A video proof requires at least three extracted frames." });
      return;
    }
    if (files.some((file) => !file.mimetype.startsWith("image/"))) {
      response.status(415).json({ error: "Video proof frames must be JPEG, PNG, or WebP images." });
      return;
    }
    if (visionMode() === "demo") {
      response.status(503).json({
        error: "Live multi-frame vision requires HF_TOKEN or an NVIDIA VISION_BASE_URL.",
      });
      return;
    }

    const orchestrator = orchestratorFrom(request);
    const previousActionIds = new Set(store.get().actions.map((action) => action.id));
    store.setInspecting(orchestrator);
    const frameDataUrls = files.map(
      (file) => `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
    );
    const observation = await analyzeWithVision(frameDataUrls, store.get().manifest);
    const state = store.applyInspection({
      observation,
      source: "video",
      imageUrl: frameDataUrls[0],
      imageDigest: sha256(Buffer.concat(files.map((file) => file.buffer))),
      mediaType: "video",
      frameCount: files.length,
      orchestrator,
    });
    const dispatch = await dispatchNewActions(state, previousActionIds);
    response.json({ state, decision: state.status, dispatch });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", (request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  const send = (state: OrderState) => {
    response.write(`data: ${JSON.stringify(state)}\n\n`);
  };
  send(store.get());
  const unsubscribe = store.subscribe(send);
  const heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 20_000);

  request.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

if (process.argv.includes("--static")) {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(currentDirectory, "../dist");
  app.use(express.static(dist));
  app.get("*", (_request, response) => response.sendFile(path.join(dist, "index.html")));
}

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  },
);

server.listen(port, "0.0.0.0", () => {
  console.log(`PARALLAX API listening on http://localhost:${port}`);
});
