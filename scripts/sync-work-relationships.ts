import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { externalLinks, workRelations, works } from "@/db/schema";

type CanonicalType =
  | "sequel"
  | "adaptation"
  | "spin-off"
  | "side-story"
  | "compilation"
  | "alternative"
  | "related";

type CanonicalRelationship = {
  sourceWorkId: string;
  targetWorkId: string;
  relationType: CanonicalType;
  notes?: string;
  provenance?: string;
  externalKey?: string | null;
};

type ProviderRelationship = {
  source: { provider: string; externalId: string };
  target: { provider: string; externalId: string };
  relationType: string;
  externalKey?: string;
};

const undirectedTypes = new Set<CanonicalType>(["alternative", "related"]);

export function canonicalizeRelationship(input: CanonicalRelationship): CanonicalRelationship {
  let { sourceWorkId, targetWorkId, relationType } = input;
  if (undirectedTypes.has(relationType) && sourceWorkId > targetWorkId) {
    [sourceWorkId, targetWorkId] = [targetWorkId, sourceWorkId];
  }
  return { ...input, sourceWorkId, targetWorkId, relationType };
}

function mapProviderType(value: string): { type: CanonicalType; reverse: boolean } | null {
  const normalized = value.trim().toLocaleLowerCase().replaceAll("_", "-");
  if (normalized === "prequel") return { type: "sequel", reverse: true };
  if (normalized === "source" || normalized === "adapted-from")
    return { type: "adaptation", reverse: true };
  if (normalized === "adaptation") return { type: "adaptation", reverse: false };
  if (
    ["sequel", "spin-off", "side-story", "compilation", "alternative", "related"].includes(
      normalized,
    )
  )
    return { type: normalized as CanonicalType, reverse: false };
  return null;
}

function providerIdentityIndex() {
  const index = new Map<string, string[]>();
  for (const link of db.select().from(externalLinks).all()) {
    const externalId =
      link.externalId ?? link.url.match(/(?:anime|manga|movie|tv|game)[/-](\d+)/i)?.[1] ?? null;
    if (!externalId) continue;
    const key = `${link.provider.toLocaleLowerCase()}:${externalId}`;
    index.set(key, [...(index.get(key) ?? []), link.ownerId]);
  }
  return index;
}

export function synchronizeRelationships(
  providerRows: ProviderRelationship[],
  overrides: CanonicalRelationship[],
  { dryRun = false }: { dryRun?: boolean } = {},
) {
  const identities = providerIdentityIndex();
  const knownWorks = new Set(
    db
      .select({ id: works.id })
      .from(works)
      .all()
      .map(({ id }) => id),
  );
  const desired = new Map<string, CanonicalRelationship>();
  const ambiguous: Array<{ relationship: ProviderRelationship; reason: string }> = [];

  for (const row of providerRows) {
    const mapped = mapProviderType(row.relationType);
    if (!mapped) {
      ambiguous.push({
        relationship: row,
        reason: `Unsupported provider type: ${row.relationType}`,
      });
      continue;
    }
    const sourceMatches =
      identities.get(`${row.source.provider.toLocaleLowerCase()}:${row.source.externalId}`) ?? [];
    const targetMatches =
      identities.get(`${row.target.provider.toLocaleLowerCase()}:${row.target.externalId}`) ?? [];
    if (sourceMatches.length !== 1 || targetMatches.length !== 1) {
      ambiguous.push({
        relationship: row,
        reason: "Provider identities did not resolve one-to-one.",
      });
      continue;
    }
    const [sourceWorkId, targetWorkId] = mapped.reverse
      ? [targetMatches[0], sourceMatches[0]]
      : [sourceMatches[0], targetMatches[0]];
    const relation = canonicalizeRelationship({
      sourceWorkId,
      targetWorkId,
      relationType: mapped.type,
      provenance: `provider:${row.source.provider.toLocaleLowerCase()}`,
      externalKey: row.externalKey ?? null,
    });
    desired.set(
      `${relation.sourceWorkId}:${relation.targetWorkId}:${relation.relationType}`,
      relation,
    );
  }

  for (const override of overrides) {
    if (!knownWorks.has(override.sourceWorkId) || !knownWorks.has(override.targetWorkId)) {
      ambiguous.push({
        relationship: {
          source: { provider: "local", externalId: override.sourceWorkId },
          target: { provider: "local", externalId: override.targetWorkId },
          relationType: override.relationType,
        },
        reason: "Override references a work that is not in this catalog.",
      });
      continue;
    }
    const relation = canonicalizeRelationship({ ...override, provenance: "override:reviewed" });
    desired.set(
      `${relation.sourceWorkId}:${relation.targetWorkId}:${relation.relationType}`,
      relation,
    );
  }

  let inserted = 0;
  let updated = 0;
  if (!dryRun) {
    db.transaction((tx) => {
      for (const relation of desired.values()) {
        const existing = tx
          .select()
          .from(workRelations)
          .where(
            and(
              eq(workRelations.sourceWorkId, relation.sourceWorkId),
              eq(workRelations.targetWorkId, relation.targetWorkId),
              eq(workRelations.relationType, relation.relationType),
            ),
          )
          .get();
        if (existing) {
          const next = {
            isDirected: !undirectedTypes.has(relation.relationType),
            notes: relation.notes ?? existing.notes,
            provenance: relation.provenance ?? existing.provenance,
            externalKey: relation.externalKey ?? existing.externalKey,
          };
          if (
            next.isDirected !== existing.isDirected ||
            next.notes !== existing.notes ||
            next.provenance !== existing.provenance ||
            next.externalKey !== existing.externalKey
          ) {
            tx.update(workRelations).set(next).where(eq(workRelations.id, existing.id)).run();
            updated += 1;
          }
        } else {
          tx.insert(workRelations)
            .values({
              id: crypto.randomUUID(),
              ...relation,
              isDirected: !undirectedTypes.has(relation.relationType),
              notes: relation.notes ?? "",
              provenance: relation.provenance ?? "manual",
              externalKey: relation.externalKey ?? null,
            })
            .run();
          inserted += 1;
        }
      }
    });
  }
  return { considered: desired.size, inserted, updated, ambiguous };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  const providerFlag = process.argv.indexOf("--provider-file");
  const providerRows =
    providerFlag >= 0
      ? readJson<ProviderRelationship[]>(resolve(process.argv[providerFlag + 1]))
      : [];
  const manifest = readJson<{ relationships: CanonicalRelationship[] }>(
    resolve("scripts/relationship-overrides.json"),
  );
  const result = synchronizeRelationships(providerRows, manifest.relationships, { dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (result.ambiguous.length > 0) process.exitCode = 2;
}
