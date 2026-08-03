#!/usr/bin/env node

const usage = `Arcadia read-only agent CLI

Usage:
  pnpm arcadia -- works [filters]
  pnpm arcadia -- work <id> [--tracking-limit <n>]
  pnpm arcadia -- tables
  pnpm arcadia -- schema [table]
  pnpm arcadia -- table <table> [--where column=value] [--order column] [--desc]

Work filters (repeat or comma-separate multi-value filters):
  --search <text>          --kind <kind>              --status <personal-status>
  --release-status <value> --genre <name>             --tag <name>
  --tone <name>            --contributor <name>       --country <name>
  --audience <name>        --provider <name>          --favorite [true|false]
  --year-from <year>       --year-to <year>           --limit <1-1000>
  --offset <n>

Table options:
  --where column=value     Exact match; repeat to combine with AND. Use value null for SQL NULL.
  --order <column>         --desc                     --limit <1-1000>
  --offset <n>

Global options:
  --url <origin>           Default: ARCADIA_URL or http://127.0.0.1:3000
  --help

All successful output is JSON on stdout. The server must be running.`;

function fail(message, hint) {
  process.stderr.write(
    `${JSON.stringify({ error: message, ...(hint ? { hint } : {}) }, null, 2)}\n`,
  );
  process.exitCode = 1;
}

function parseArguments(argv) {
  const positionals = [];
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const [rawName, inlineValue] = argument.slice(2).split(/=(.*)/s, 2);
    let value = inlineValue;
    if (value === undefined && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      value = argv[index + 1];
      index += 1;
    }
    const current = options.get(rawName) ?? [];
    current.push(value ?? "true");
    options.set(rawName, current);
  }
  return { positionals, options };
}

function assertOptions(options, allowed) {
  for (const name of options.keys()) {
    if (!allowed.has(name)) throw new Error(`Unknown option: --${name}`);
  }
}

function appendOptions(params, options, aliases = {}) {
  for (const [name, entries] of options) {
    if (["url", "help"].includes(name)) continue;
    const target = aliases[name] ?? name;
    for (const entry of entries) params.append(target, entry);
  }
}

async function main() {
  const { positionals, options } = parseArguments(process.argv.slice(2));
  if (options.has("help") || positionals.length === 0) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  const command = positionals[0];
  const baseUrl = (
    options.get("url")?.at(-1) ??
    process.env.ARCADIA_URL ??
    "http://127.0.0.1:3000"
  ).replace(/\/+$/, "");
  const endpoint = new URL(`${baseUrl}/api/agent`);
  const global = ["url", "help"];

  if (command === "works") {
    if (positionals.length > 1) throw new Error("works does not accept positional arguments");
    assertOptions(
      options,
      new Set([
        ...global,
        "search",
        "kind",
        "status",
        "release-status",
        "genre",
        "tag",
        "tone",
        "contributor",
        "country",
        "audience",
        "provider",
        "favorite",
        "year-from",
        "year-to",
        "limit",
        "offset",
      ]),
    );
    endpoint.searchParams.set("resource", "works");
    appendOptions(endpoint.searchParams, options);
  } else if (command === "work") {
    assertOptions(options, new Set([...global, "tracking-limit"]));
    if (positionals.length !== 2) throw new Error("work requires exactly one work id");
    endpoint.searchParams.set("resource", "work");
    endpoint.searchParams.set("id", positionals[1]);
    appendOptions(endpoint.searchParams, options);
  } else if (command === "tables") {
    assertOptions(options, new Set(global));
    if (positionals.length > 1) throw new Error("tables does not accept positional arguments");
    endpoint.searchParams.set("resource", "tables");
  } else if (command === "schema") {
    assertOptions(options, new Set(global));
    if (positionals.length > 2) throw new Error("schema accepts at most one table name");
    endpoint.searchParams.set("resource", "schema");
    if (positionals[1]) endpoint.searchParams.set("table", positionals[1]);
  } else if (command === "table") {
    assertOptions(options, new Set([...global, "where", "order", "desc", "limit", "offset"]));
    if (positionals.length !== 2) throw new Error("table requires exactly one table name");
    endpoint.searchParams.set("resource", "table");
    endpoint.searchParams.set("table", positionals[1]);
    appendOptions(endpoint.searchParams, options, { desc: "descending" });
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  let response;
  try {
    response = await fetch(endpoint, { headers: { accept: "application/json" } });
  } catch (error) {
    throw new Error(
      `Cannot reach Arcadia at ${baseUrl}: ${error instanceof Error ? error.message : error}`,
    );
  }
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Arcadia returned a non-JSON response (${response.status})`);
  }
  if (!response.ok) throw new Error(body.error ?? `Arcadia request failed (${response.status})`);
  process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error), "Run with --help for usage.");
});
