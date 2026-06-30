import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["node_modules/tsx/dist/cli.mjs", "server/mcp.ts"],
  env: {
    ...process.env,
    PARALLAX_API_URL: process.env.PARALLAX_API_URL ?? "http://127.0.0.1:8787",
  },
});

const client = new Client({ name: "parallax-smoke", version: "1.0.0" });
await client.connect(transport);

const listed = await client.listTools();
const names = listed.tools.map((tool) => tool.name);
const expected = [
  "get_operation",
  "list_protocols",
  "compile_operation",
  "inspect_fixture",
  "inspect_image",
  "verify_evidence_ledger",
  "reset_operation",
];

if (expected.some((name) => !names.includes(name))) {
  throw new Error(`MCP tools missing: ${names.join(", ")}`);
}

const protocolsResult = await client.callTool({
  name: "list_protocols",
  arguments: {},
});
const protocols = JSON.parse(protocolsResult.content[0].text);
if (protocols.length < 3) throw new Error("Protocol templates are missing.");

const fieldService = protocols.find((protocol) => protocol.protocol.domain === "Field service");
if (!fieldService) throw new Error("Field-service protocol is missing.");
const compiledResult = await client.callTool({
  name: "compile_operation",
  arguments: {
    operationId: fieldService.operationId,
    station: fieldService.station,
    destination: fieldService.destination,
    protocolId: fieldService.protocol.id,
    protocolName: fieldService.protocol.name,
    domain: fieldService.protocol.domain,
    objective: fieldService.protocol.objective,
    valueAtRisk: fieldService.protocol.valueAtRisk,
    currency: fieldService.protocol.currency,
    manifest: fieldService.manifest,
  },
});
const compiled = JSON.parse(compiledResult.content[0].text);
if (compiled.protocol.domain !== "Field service") {
  throw new Error("Protocol compilation did not activate field service.");
}
await client.callTool({ name: "reset_operation", arguments: {} });
const verified = await client.callTool({
  name: "verify_evidence_ledger",
  arguments: {},
});
const payload = JSON.parse(verified.content[0].text);
if (!payload.valid) throw new Error("MCP ledger verification failed.");

console.log(
  `MCP_OK tools=${names.length} protocols=${protocols.length} ledger_entries=${payload.entries}`,
);
await client.close();
