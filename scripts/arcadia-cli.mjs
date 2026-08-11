#!/usr/bin/env node

const apiUrl = (process.env.ARCADIA_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const [command, ...args] = process.argv.slice(2);

function usage() {
  console.error(`Usage:
  pnpm arcadia -- health
  pnpm arcadia -- titles [--search TEXT] [--mode titles|installments] [--sort title|release|score]
                         [--genre SLUG] [--tone SLUG] [--tag SLUG] [--planet SLUG]
                         [--limit N] [--offset N]
  pnpm arcadia -- title TITLE_ID
  pnpm arcadia -- list planets|people|studios|relationships|organization-relationships`);
}

function optionMap(values) {
  const options = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Expected a value after ${name ?? "option"}`);
    }
    options.set(name.slice(2), value);
  }
  return options;
}

async function request(path) {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({ message: response.statusText }));
  if (!response.ok) throw new Error(body.message ?? `Arcadia API returned ${response.status}`);
  process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
}

try {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    process.exitCode = command ? 0 : 1;
  } else if (command === "health") {
    await request("/api/v1/health");
  } else if (command === "titles") {
    const options = optionMap(args);
    const supported = new Set([
      "search",
      "mode",
      "sort",
      "genre",
      "tone",
      "tag",
      "planet",
      "limit",
      "offset",
    ]);
    for (const key of options.keys()) {
      if (!supported.has(key)) throw new Error(`Unknown titles option --${key}`);
    }
    const query = new URLSearchParams();
    for (const [key, value] of options) query.set(key === "search" ? "q" : key, value);
    await request(`/api/v1/titles${query.size ? `?${query}` : ""}`);
  } else if (command === "title") {
    if (args.length !== 1) throw new Error("title requires exactly one title UUID");
    await request(`/api/v1/titles/${encodeURIComponent(args[0])}`);
  } else if (command === "list") {
    const resource = args[0];
    const supported = new Set([
      "planets",
      "people",
      "studios",
      "relationships",
      "organization-relationships",
    ]);
    if (args.length !== 1 || !resource || !supported.has(resource)) {
      throw new Error("list requires one supported resource");
    }
    await request(`/api/v1/${resource}`);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
