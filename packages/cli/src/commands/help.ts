/**
 * `arcadia help` — self-description.
 *
 * The command tree is data, not a printf block, so `--json` can hand an agent the whole
 * interface in one call and it never has to guess at a flag name.
 */

import { resources } from "../registry";
import { statsPresets } from "./stats";

export type CommandDoc = {
  usage: string;
  summary: string;
  flags?: Record<string, string>;
  examples?: string[];
};

export const globalFlags = {
  "--json": "Emit JSON instead of the default text table.",
  "--ndjson": "Emit one JSON object per line.",
  "--csv": "Emit CSV.",
  "--wide": "Do not truncate long cells in table output.",
  "--dry-run": "Show what a write would do without committing it.",
  "--yes": "Confirm a write that affects more than one row.",
  "--camel": "Return camelCase keys instead of the database's snake_case.",
} satisfies Record<string, string>;

export const commands = new Map<string, CommandDoc>(Object.entries<CommandDoc>({
  "<resource> list": {
    usage:
      "arcadia <resource> list [--search TEXT] [--where EXPR]… [--columns a,b] [--limit N] [--offset N] [--order COL[ desc]] [--count] [--all-columns]",
    summary: "List rows. Shows a curated column set unless --columns or --all-columns is given.",
    flags: {
      "--where":
        "Repeatable filter: col=v, col!=v, col~substring, col>v, col<v, col:in=a,b,c, col=null.",
      "--search": "Substring match across the resource's searchable columns.",
      "--count": "Return only the number of matching rows.",
    },
    examples: [
      "arcadia title list --search frieren",
      "arcadia title list --where theology_risk:in=medium,high --where workflow_status=published --limit 20",
      "arcadia installment list --where title_id=$(arcadia title get Arcane --json | jq -r .id)",
      'arcadia title list --count --where "release_year>=2020"',
    ],
  },
  "<resource> get": {
    usage: "arcadia <resource> get <ref>",
    summary: "Fetch one row. <ref> may be a UUID, a slug, a name, or a title alias.",
    examples: ["arcadia title get Arcane", "arcadia planet get emerald"],
  },
  "<resource> create": {
    usage: "arcadia <resource> create --set col=value [--set …] [--json-set col=<json>]",
    summary: "Insert a row. Foreign keys accept references, not just UUIDs.",
    examples: [
      "arcadia person create --set name='Naoko Yamada' --set sort_name='Yamada, Naoko'",
      "arcadia genre create --set slug=isekai --set label_en=Isekai --set label_ar=إيسيكاي",
    ],
  },
  "<resource> update": {
    usage: "arcadia <resource> update [<ref>] --set col=value [--where EXPR]…",
    summary:
      "Update one row by reference, or every row matching --where. Never both, never neither.",
    examples: [
      "arcadia title update Arcane --set theology_risk=high",
      'arcadia title update --where "workflow_status=draft" --set workflow_status=published --yes',
    ],
  },
  "<resource> delete": {
    usage: "arcadia <resource> delete [<ref>] [--where EXPR]… [--yes]",
    summary: "Delete by reference or filter. Deleting more than one row requires --yes.",
    examples: ['arcadia alias delete --where "title_id=…" --yes'],
  },
  "work apply": {
    usage: "arcadia work apply <file.json> [--mode merge|replace] [--create-missing] [--dry-run]",
    summary:
      "Reconcile a whole work — title, classification, vocabulary, credits, installments, episodes, scores, awards, media — from one JSON document, in one transaction.",
    flags: {
      "--mode":
        "merge (default) only touches what the document mentions; replace deletes anything absent.",
      "--create-missing":
        "Create referenced genres/tones/tags/entities/award orgs that do not exist yet.",
      "--json": "Pass the document inline instead of via a file.",
    },
    examples: [
      "arcadia work template > new-work.json",
      "arcadia work apply new-work.json --dry-run",
      "arcadia work apply new-work.json --create-missing",
    ],
  },
  "work export": {
    usage: "arcadia work export <ref>",
    summary: "Emit a work as an apply-compatible document. Round-trips with `work apply`.",
    examples: ["arcadia work export Arcane --json > arcane.json"],
  },
  "work template": {
    usage: "arcadia work template",
    summary: "Print a filled-in example document to start a new work from.",
  },
  stats: {
    usage:
      "arcadia stats [<preset>|<resource>] [--by col,col] [--metric M,…] [--where EXPR]… [--order …] [--limit N]",
    summary: `Aggregate reporting. Presets: ${statsPresets.join(", ")}. Any resource also supports a generic group-by.`,
    flags: {
      "--by": "Group by these columns.",
      "--metric": "count (default), count-distinct:col, avg:col, sum:col, min:col, max:col.",
    },
    examples: [
      "arcadia stats coverage",
      "arcadia stats titles --by audience,theology_risk",
      "arcadia stats score --metric avg:story,avg:craft",
      'arcadia stats titles --by release_year --where "release_year>=2015" --order "release_year desc"',
    ],
  },
  schema: {
    usage: "arcadia schema [<table|resource>] [--enums] [--resources] [--search TEXT]",
    summary:
      "Describe tables, columns, types, foreign keys, and enum members from the live database.",
    examples: ["arcadia schema", "arcadia schema titles", "arcadia schema --enums"],
  },
  sql: {
    usage: 'arcadia sql "<statement>" [--write] [--dry-run] [--file query.sql]',
    summary:
      "Run raw SQL. Read-only by default, enforced by a READ ONLY transaction. --write allows mutations; --write --dry-run runs then rolls back.",
    examples: [
      'arcadia sql "select canonical_title from titles where release_year = 2024"',
      "arcadia sql --write --dry-run \"update titles set quality_score = 5 where id = '…'\"",
    ],
  },
  media: {
    usage:
      "arcadia media ingest <file-or-url> --role poster|banner|logo|profile [--title|--installment|--episode|--entity <ref>]",
    summary:
      "Ingest an image (content-addressed, deduplicated by sha256) and optionally assign it. Also: media assign, media purge.",
    examples: [
      "arcadia media ingest ./poster.jpg --role poster --title Arcane",
      "arcadia media ingest https://example.com/banner.jpg --role banner --title Arcane",
      "arcadia media purge --dry-run",
    ],
  },
  refs: {
    usage: "(concept)",
    summary:
      "Anywhere a <ref> or a foreign-key value is accepted you may pass a UUID, a slug, a name, or a title/entity alias. Resolution tries exact match first, then prefix, then substring; an ambiguous reference fails with the candidate ids listed.",
  },
}));

export function helpDocument() {
  return {
    usage: "arcadia <command> [args] [flags]",
    globalFlags,
    commands: Object.fromEntries(commands),
    resources: resources.map((resource) => ({
      name: resource.name,
      table: resource.table,
      aliases: (resource.aliases ?? []).join(", "),
      summary: resource.summary,
    })),
    note: "Any table not in the resource list is still reachable by its real table name.",
  };
}

export function helpText(topic?: string): string {
  const doc = topic ? commands.get(topic) : undefined;
  if (doc) {
    return [
      doc.usage,
      "",
      doc.summary,
      ...(doc.flags
        ? [
            "",
            "Flags:",
            ...Object.entries(doc.flags).map(([name, text]) => `  ${name.padEnd(18)}${text}`),
          ]
        : []),
      ...(doc.examples ? ["", "Examples:", ...doc.examples.map((line) => `  ${line}`)] : []),
    ].join("\n");
  }

  const lines = [
    "arcadia — read and edit the Arcadia v2 PostgreSQL catalog.",
    "",
    "Usage: arcadia <command> [args] [flags]",
    "",
    "Commands:",
    ...[...commands.entries()].map(
      ([name, entry]) => `  ${name.padEnd(18)}${entry.summary.split(".")[0]}.`,
    ),
    "",
    "Resources:",
    `  ${resources.map((resource) => resource.name).join(", ")}`,
    "  (plus any table by its real name — see: arcadia schema)",
    "",
    "Global flags:",
    ...Object.entries(globalFlags).map(([name, text]) => `  ${name.padEnd(14)}${text}`),
    "",
    'Detail: arcadia help "<command>"   Full tree as JSON: arcadia help --json',
  ];
  return lines.join("\n");
}
