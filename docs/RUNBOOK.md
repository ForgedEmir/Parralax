# PARALLAX Runbook

## Start the application

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The API listens on port `8787`; Vite proxies `/api` to it. The declared fixture replay works without an account or API key.

## Enable live visual inspection

PARALLAX defaults to `Qwen/Qwen3-VL-8B-Instruct`, an Apache 2.0 open-weight model combining OCR, object recognition, and spatial understanding.

Create `.env` from `.env.example` and set:

```dotenv
HF_TOKEN=hf_your_read_token
HF_VISION_MODEL=Qwen/Qwen3-VL-8B-Instruct
```

Restart the server. The mobile screen at `/capture` enables `Analyze evidence`.

For a local vLLM or another OpenAI-compatible endpoint:

```dotenv
VISION_BASE_URL=http://127.0.0.1:8000/v1
VISION_MODEL=Qwen/Qwen3-VL-8B-Instruct
VISION_API_KEY=
```

The custom endpoint takes priority over Hugging Face.

For NVIDIA's hosted VLM NIM, the same OpenAI-compatible adapter works without code changes:

```dotenv
VISION_BASE_URL=https://integrate.api.nvidia.com/v1
VISION_API_KEY=nvapi-your-key
VISION_MODEL=nvidia/llama-3.1-nemotron-nano-vl-8b-v1
```

Keep secrets in `.env`; never commit them.

## Connect a real operations system

Set an optional webhook to deliver every new action to a WMS, ERP, ticketing system, or notification service:

```dotenv
ACTION_WEBHOOK_URL=https://operations.example/parallax
ACTION_WEBHOOK_SECRET=replace-with-a-random-secret
```

PARALLAX sends one signed request per action with `Idempotency-Key`, `X-Parallax-Event`, evidence digest, and ledger head. External delivery failures do not let the model bypass or reverse deterministic local policy.
## Connect Hermes Agent

Keep the PARALLAX API running, then add the stdio MCP server:

```bash
hermes mcp add parallax --command pnpm --env PARALLAX_API_URL=http://127.0.0.1:8787 --args --dir /absolute/path/to/parallax mcp
```

Confirm all discovered tools. Alternatively, merge `hermes.mcp.example.yaml` into `~/.hermes/config.yaml`, replace the project path, and run `/reload-mcp`.

Hermes receives seven tools:

- `mcp_parallax_get_operation`
- `mcp_parallax_list_protocols`
- `mcp_parallax_compile_operation`
- `mcp_parallax_inspect_fixture`
- `mcp_parallax_inspect_image`
- `mcp_parallax_verify_evidence_ledger`
- `mcp_parallax_reset_operation`

The project-level `HERMES.md` enforces the operating policy.

## Run the real Hermes demo

```bash
pnpm demo:hermes
```

Hermes resets the run, invokes mismatch inspection, reads the repair directive, verifies corrected evidence, and validates the ledger. The dashboard updates live and marks agent-originated events as `Hermes signed`.

## Switch visual protocols

The dashboard protocol menu has two complete verified visual stories:

- `Fulfillment pack-out`: wrong mug and missing warranty card
- `Field service closeout`: installed filter but missing safety seal and service label

The retail template remains a compiler example until real evidence is supplied.

## Compile another operation

Ask Hermes to list protocol templates or call `compile_operation` with a custom manifest. Fixture images belong to the two declared visual demos; custom protocols should use real evidence through `inspect_image`.

## Verify

```bash
pnpm verify
```

Production mode serves the compiled site and API together:

```bash
pnpm start
```
