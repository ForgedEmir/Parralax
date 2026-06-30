import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const windowsHermes = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "hermes", "hermes-agent", "venv", "Scripts", "hermes.exe")
  : "";
const command =
  process.env.HERMES_COMMAND || (windowsHermes && existsSync(windowsHermes) ? windowsHermes : "hermes");
const prompt = [
  "Operate PARALLAX autonomously through its MCP tools.",
  "Reset the operation, inspect the mismatch-angle fixture, and read the generated repair directive.",
  "Inspect corrected-angle, then inspect damaged and confirm that condition mismatch blocks the complete package.",
  "Inspect replacement, verify the full evidence history, and verify the evidence ledger.",
  "Do not skip any tool call. Return a concise operational report with all four decisions, corrections, actions, value protected, evidence-history hashes, and ledger validity.",
].join(" ");

const child = spawn(command, ["--oneshot", prompt], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`Unable to start Hermes: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
