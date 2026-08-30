/**
 * @flowchart/cli — Generate diagrams from the terminal
 *
 * Usage:
 *   npx @flowchart/cli generate "User login flow" --out diagram.json
 *   npx @flowchart/cli list-types
 *
 * Config (~/.flowchart/config.json):
 *   { "apiKey": "sk-...", "baseUrl": "http://localhost:3040" }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DIAGRAM_TYPE_META, type DiagramType } from "@flowchart/core";

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), ".flowchart");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

type Config = {
  apiKey?: string;
  baseUrl?: string;
};

function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Config;
  } catch {
    return {};
  }
}

function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  chmodSync(CONFIG_DIR, 0o700);
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}

// ─── Arg parser ──────────────────────────────────────────────────────────────

type ParsedArgs = {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;
  const command = args[i++] ?? "help";
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }
  return { command, positional, flags };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) { process.stdout.write(msg + "\n"); }
function err(msg: string) { process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`); }
function dim(s: string) { return `\x1b[2m${s}\x1b[0m`; }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function cyan(s: string) { return `\x1b[36m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdGenerate(positional: string[], flags: Record<string, string | boolean>) {
  const prompt = positional[0];
  if (!prompt) {
    err('Provide a prompt: flowchart generate "User login flow"');
    process.exit(1);
  }

  const config = loadConfig();
  const baseUrl = (flags["base-url"] as string) || config.baseUrl || "http://localhost:3040";
  const apiKey = (flags["api-key"] as string) || config.apiKey;

  const diagramType: DiagramType = "freeform";
  const outFile = flags["out"] as string | undefined;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  log(dim(`Generating ${diagramType} diagram…`));

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/ai/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        diagramType,
        compact: false,
      }),
    });
  } catch (e) {
    err(`Could not connect to ${baseUrl}. Is the dev server running?`);
    process.exit(1);
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch { /* ignore */ }
    err(msg);
    process.exit(1);
  }

  const data = (await res.json()) as { source?: string; error?: string };
  if (!data.source) {
    err(data.error ?? "No source returned");
    process.exit(1);
  }

  if (outFile) {
    writeFileSync(outFile, data.source, "utf8");
    log(green(`✓`) + ` Saved to ${bold(outFile)}`);
  } else {
    log("");
    log(data.source);
    log("");
    log(dim(`─────────────────────────────────`));
    log(dim(`Pipe output using: --out diagram.mmd`));
  }
}

function cmdListTypes(_flags: Record<string, string | boolean>) {
  log("");
  log(bold("Diagram types  (--type <id>)"));
  log("");
  for (const dt of DIAGRAM_TYPE_META) {
    log(`  ${cyan(dt.id.padEnd(12))} ${dt.label}`);
  }
  log("");
}

function cmdConfig(positional: string[], _flags: Record<string, string | boolean>) {
  const sub = positional[0];
  const config = loadConfig();

  if (sub === "set") {
    const key = positional[1];
    const val = positional[2];
    if (!key || !val) {
      err("Usage: flowchart config set <key> <value>");
      err("  Keys: apiKey, baseUrl");
      process.exit(1);
    }
    (config as Record<string, string>)[key] = val;
    saveConfig(config);
    log(green("✓") + ` Set ${bold(key)}`);
  } else if (sub === "show") {
    log(JSON.stringify({ ...config, apiKey: config.apiKey ? "********" : undefined }, null, 2));
  } else {
    log(`Config file: ${dim(CONFIG_FILE)}`);
    log("");
    log("  flowchart config set apiKey  <your-key>");
    log("  flowchart config set baseUrl http://localhost:3040");
    log("  flowchart config show");
  }
}

function cmdHelp() {
  log("");
  log(bold("flowchart") + dim(" — Flowchart Studio CLI"));
  log("");
  log("  " + bold("generate") + ` ${cyan('"<prompt>"')}  ${dim("[options]")}`);
  log(`       ${dim("--type      <diagramType>   default: mermaid")}`);
  log(`       ${dim("--subtype   <mermaidSubtype> e.g. sequence, er, gantt")}`);
  log(`       ${dim("--out       <file>           save output to file")}`);
  log(`       ${dim("--base-url  <url>            override server URL")}`);
  log(`       ${dim("--api-key   <key>            override API key")}`);
  log("");
  log("  " + bold("list-types") + "                  Show all diagram types and subtypes");
  log("  " + bold("config") + " set|show           Manage ~/.flowchart/config.json");
  log("  " + bold("help") + "                       Show this message");
  log("");
  log(dim("Examples:"));
  log(`  ${dim("flowchart generate")} "User login flow"`);
  log(`  ${dim("flowchart generate")} "Payment API" ${dim("--type mermaid --subtype sequence --out auth.mmd")}`);
  log(`  ${dim("flowchart generate")} "Products DB" ${dim("--type mermaid --subtype er --out schema.mmd")}`);
  log(`  ${dim("flowchart generate")} "Sales data"  ${dim("--type echarts --out chart.json")}`);
  log(`  ${dim("flowchart list-types")}`);
  log(`  ${dim("flowchart config set baseUrl http://localhost:3040")}`);
  log("");
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main() {
  const { command, positional, flags } = parseArgs(process.argv);

  if (flags["help"] || flags["h"]) {
    cmdHelp();
    process.exit(0);
  }

  switch (command) {
    case "generate":
    case "gen":
      await cmdGenerate(positional, flags);
      break;
    case "list-types":
    case "types":
      cmdListTypes(flags);
      break;
    case "config":
      cmdConfig(positional, flags);
      break;
    case "help":
    default:
      cmdHelp();
      break;
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`Unexpected error: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
