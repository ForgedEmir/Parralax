import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithVision, visionMode, visionModel } from "./vision.js";

const originalEnvironment = {
  HF_TOKEN: process.env.HF_TOKEN,
  HF_VISION_MODEL: process.env.HF_VISION_MODEL,
  VISION_BASE_URL: process.env.VISION_BASE_URL,
  VISION_API_KEY: process.env.VISION_API_KEY,
  VISION_MODEL: process.env.VISION_MODEL,
};

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("vision provider selection", () => {
  it("selects the stronger open Qwen fallback on Hugging Face", () => {
    delete process.env.VISION_BASE_URL;
    process.env.HF_TOKEN = "test-token";
    delete process.env.HF_VISION_MODEL;

    expect(visionMode()).toBe("huggingface");
    expect(visionModel()).toBe("Qwen/Qwen3-VL-30B-A3B-Instruct");
  });

  it("prefers a custom OpenAI-compatible endpoint", () => {
    process.env.HF_TOKEN = "test-token";
    process.env.VISION_BASE_URL = "http://vision.local/v1";
    process.env.VISION_MODEL = "local-qwen";

    expect(visionMode()).toBe("custom");
    expect(visionModel()).toBe("local-qwen");
  });
});

describe("structured vision extraction", () => {
  it("sends image evidence and validates the returned observation", async () => {
    process.env.VISION_BASE_URL = "http://vision.local/v1";
    process.env.VISION_API_KEY = "secret";
    process.env.VISION_MODEL = "local-qwen";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "One red mug is visible.",
                  evidenceConfidence: 0.94,
                  items: [
                    {
                      sku: "MUG-RED-01",
                      label: "Ceramic mug",
                      quantity: 1,
                      color: "red",
                      confidence: 0.96,
                    },
                  ],
                  notes: ["Label readable"],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const observation = await analyzeWithVision("data:image/png;base64,AA==", [
      { sku: "MUG-RED-01", label: "Ceramic mug", quantity: 1, color: "red" },
    ]);

    expect(observation.model).toBe("local-qwen");
    expect(observation.items[0].color).toBe("red");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://vision.local/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer secret");
    expect(JSON.parse(init.body).messages[1].content[1].image_url.url).toBe(
      "data:image/png;base64,AA==",
    );
  });
});
