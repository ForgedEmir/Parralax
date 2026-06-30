import { z } from "zod";
import type { Observation } from "../shared/types.js";

const observationSchema = z.object({
  summary: z.string(),
  evidenceConfidence: z.number().min(0).max(1),
  items: z.array(
    z.object({
      sku: z.string(),
      label: z.string(),
      quantity: z.number().int().nonnegative(),
      color: z.string().optional(),
      condition: z.string().optional(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  notes: z
    .union([z.array(z.string()), z.string()])
    .transform((value) => (Array.isArray(value) ? value : [value])),
});

const manifestLearnSchema = z.object({
  summary: z.string(),
  items: z.array(
    z.object({
      label: z.string(),
      quantity: z.number().int().positive(),
      color: z.string().optional(),
      condition: z.string().optional(),
    }),
  ),
});

export interface LearnedManifest {
  summary: string;
  items: Array<{ label: string; quantity: number; color?: string; condition?: string }>;
  model: string;
  latencyMs: number;
}

export type VisionMode = "demo" | "huggingface" | "custom";

const DEFAULT_HF_VISION_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct";
const DEFAULT_NVIDIA_VISION_MODEL =
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

export const visionMode = (): VisionMode => {
  if (process.env.VISION_BASE_URL) return "custom";
  if (process.env.HF_TOKEN) return "huggingface";
  return "demo";
};

export const visionModel = () => {
  if (visionMode() === "custom") {
    return process.env.VISION_MODEL ?? DEFAULT_NVIDIA_VISION_MODEL;
  }
  return process.env.HF_VISION_MODEL ?? DEFAULT_HF_VISION_MODEL;
};

async function callVisionModel(
  systemPrompt: string,
  userText: string,
  imageDataUrls: string[],
  maxTokens: number,
): Promise<{ raw: string; latencyMs: number }> {
  const mode = visionMode();
  if (mode === "demo") {
    throw new Error("Live vision is not configured on this server.");
  }

  const endpoint =
    mode === "custom"
      ? `${process.env.VISION_BASE_URL!.replace(/\/$/, "")}/chat/completions`
      : "https://router.huggingface.co/v1/chat/completions";
  const apiKey = mode === "custom" ? process.env.VISION_API_KEY : process.env.HF_TOKEN;

  const startedAt = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: visionModel(),
      temperature: visionModel().includes("nemotron-3-nano-omni") ? 0.2 : 0,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            ...imageDataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Vision provider failed with ${response.status}: ${details.slice(0, 240)}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) throw new Error("The vision model returned no structured observation.");
  return { raw: raw.replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/, ""), latencyMs: Math.round(performance.now() - startedAt) };
}

export async function analyzeWithVision(
  imageDataUrl: string | string[],
  manifest: unknown,
): Promise<Observation> {
  const imageDataUrls = Array.isArray(imageDataUrl) ? imageDataUrl : [imageDataUrl];
  const { raw, latencyMs } = await callVisionModel(
    "You are a visual evidence extractor with OCR capability. Return concise JSON only. Observe physical facts but never decide whether the operation passes; deterministic policy owns that decision. Report only visible objects, labels, quantities, attributes, physical condition or visible damage, notes, and calibrated confidence.",
    `Inspect this image or ordered multi-frame evidence of a physical operation against the reference requirements ${JSON.stringify(manifest)}. Read visible labels and inspect physical objects. Return {summary,evidenceConfidence,items:[{sku,label,quantity,color,condition,confidence}],notes}. Use a reference SKU only when the item can be matched reliably. If the image is unclear, lower evidenceConfidence instead of guessing.`,
    imageDataUrls,
    1200,
  );
  const parsed = observationSchema.parse(JSON.parse(raw));

  return { ...parsed, model: visionModel(), latencyMs };
}

export async function learnManifestFromImage(imageDataUrl: string): Promise<LearnedManifest> {
  const { raw, latencyMs } = await callVisionModel(
    "You are a visual evidence extractor with OCR capability. Return concise JSON only. Describe a reference photo as a manifest of physical requirements for future comparison photos. Group identical items into one entry with the correct quantity.",
    "Describe this reference photo as a manifest of required items. Return {summary,items:[{label,quantity,color,condition}]}. Use the most specific visible color and condition for each distinct item.",
    [imageDataUrl],
    800,
  );
  const parsed = manifestLearnSchema.parse(JSON.parse(raw));

  return { ...parsed, model: visionModel(), latencyMs };
}
