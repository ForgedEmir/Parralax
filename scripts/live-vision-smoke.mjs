import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const apiPort = 8788;
const visionPort = 8790;
const observation = {
  summary: "All expected items are visible in the uploaded package.",
  evidenceConfidence: 0.97,
  items: [
    { sku: "MUG-RED-01", label: "Ceramic mug", quantity: 1, color: "red", condition: "intact", confidence: 0.98 },
    { sku: "CBL-USBC-2M", label: "USB-C cable", quantity: 1, color: "black", confidence: 0.98 },
    { sku: "DOC-WARRANTY", label: "Warranty card", quantity: 1, color: "white", confidence: 0.96 },
  ],
  notes: ["Mock provider used for transport-contract verification"],
};

const mockVision = createServer((request, response) => {
  if (request.url !== "/v1/chat/completions" || request.method !== "POST") {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    const payload = JSON.parse(body);
    const image = payload.messages?.[1]?.content?.[1]?.image_url?.url;
    if (!image?.startsWith("data:image/png;base64,")) {
      response.writeHead(400).end(JSON.stringify({ error: "Image data URL missing" }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(observation) } }] }));
  });
});

const waitForHealth = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("PARALLAX integration server did not start.");
};

await new Promise((resolve) => mockVision.listen(visionPort, "127.0.0.1", resolve));
const api = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/index.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(apiPort),
    VISION_BASE_URL: `http://127.0.0.1:${visionPort}/v1`,
    VISION_MODEL: "mock-vision-provider",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForHealth();
  const bytes = await readFile("public/evidence/package-corrected.png");
  const form = new FormData();
  form.set("evidence", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "package.png");
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/order/inspect-upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  if (result.state.status !== "RELEASED") throw new Error(`Unexpected state: ${result.state.status}`);
  if (result.state.evidence.source !== "upload") throw new Error("Evidence source is not upload.");
  if (result.state.evidence.digest.length !== 64) throw new Error("Evidence digest is not SHA-256.");
  if (result.state.observation.model !== "mock-vision-provider") throw new Error("Vision model metadata missing.");
  await fetch(`http://127.0.0.1:${apiPort}/api/order/reset`, { method: "POST" });
  const burst = new FormData();
  for (let index = 0; index < 4; index += 1) {
    burst.append("frames", new Blob([new Uint8Array(bytes)], { type: "image/png" }), `frame-${index + 1}.png`);
  }
  const burstResponse = await fetch(`http://127.0.0.1:${apiPort}/api/order/inspect-burst`, {
    method: "POST",
    body: burst,
  });
  const burstResult = await burstResponse.json();
  if (!burstResponse.ok) throw new Error(JSON.stringify(burstResult));
  if (burstResult.state.status !== "RELEASED") throw new Error(`Unexpected burst state: ${burstResult.state.status}`);
  if (burstResult.state.evidence.source !== "video") throw new Error("Burst evidence source is not video.");
  if (burstResult.state.evidence.frameCount !== 4) throw new Error("Burst frame count is not preserved.");
  if (burstResult.state.evidenceHistory.length !== 1) throw new Error("Burst evidence history is missing.");

  console.log(
    `VISION_CONTRACT_OK image=${result.state.status} burst=${burstResult.state.status} frames=${burstResult.state.evidence.frameCount} digest=${burstResult.state.evidence.digest.slice(0, 10)}...`,
  );
} finally {
  api.kill();
  await new Promise((resolve) => mockVision.close(resolve));
}
