import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const npxCommand = process.env.NPX_COMMAND ?? "npx";
const magicKey = process.env.MAGIC_API_KEY;
const useCodexWrapper = process.env.MAGIC_USE_CODEX_WRAPPER === "1";
const transport = new StdioClientTransport({
  command: useCodexWrapper ? "powershell.exe" : npxCommand,
  args: useCodexWrapper
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", process.env.USERPROFILE + "\\.codex\\mcp\\21st-magic.ps1"]
    : ["-y", "@21st-dev/magic@latest"],
  env: {
    ...process.env,
    ...(magicKey ? { API_KEY: magicKey } : {}),
  },
});

const client = new Client({ name: "parallax-21st-smoke", version: "1.0.0" });
await client.connect(transport);

const listed = await client.listTools();
if (!process.env.MAGIC_SEARCH_QUERY) {
  console.log(JSON.stringify(listed.tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })), null, 2));
}

if (process.env.MAGIC_SEARCH_QUERY) {
  const result = await client.callTool({
    name: "21st_magic_component_inspiration",
    arguments: {
      message: process.env.MAGIC_SEARCH_MESSAGE ?? process.env.MAGIC_SEARCH_QUERY,
      searchQuery: process.env.MAGIC_SEARCH_QUERY,
    },
  });
  console.log("--- INSPIRATION ---");
  for (const item of result.content) {
    if (item.type === "text") console.log(item.text);
  }
}

await client.close();
