import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import postgres from "postgres";

type Row = Record<string, unknown>;
const repositoryRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const sourcePath = process.env.ARCADIA_V1_DB_PATH ?? resolve(repositoryRoot, "data/arcadia.db");
if (!existsSync(sourcePath)) throw new Error(`SQLite source not found: ${sourcePath}`);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const rows = (table: string) => source.prepare(`select * from "${table}"`).all() as Row[];
const works = rows("works").filter((work) =>
  ["movie", "series", "anime"].includes(String(work.kind)),
);
const workById = new Map(works.map((work) => [String(work.id), work]));
const sequelRelations = rows("work_relations").filter((relation) => {
  const left = workById.get(String(relation.source_work_id));
  const right = workById.get(String(relation.target_work_id));
  return (
    relation.relation_type === "sequel" &&
    left &&
    right &&
    (left.kind === "movie" || right.kind === "movie")
  );
});

const parent = new Map(works.map((work) => [String(work.id), String(work.id)]));
const find = (id: string): string => {
  const current = parent.get(id) ?? id;
  if (current === id) return id;
  const root = find(current);
  parent.set(id, root);
  return root;
};
const union = (left: string, right: string) => parent.set(find(right), find(left));
for (const relation of sequelRelations)
  union(String(relation.source_work_id), String(relation.target_work_id));

const components = new Map<string, string[]>();
for (const relation of sequelRelations) {
  for (const id of [String(relation.source_work_id), String(relation.target_work_id)]) {
    const root = find(id);
    const members = components.get(root) ?? [];
    if (!members.includes(id)) members.push(id);
    components.set(root, members);
  }
}

const incoming = new Set(sequelRelations.map((relation) => String(relation.target_work_id)));
const compareWorks = (leftId: string, rightId: string) => {
  const left = workById.get(leftId);
  const right = workById.get(rightId);
  return (
    Number(left?.release_year ?? 9999) - Number(right?.release_year ?? 9999) ||
    String(left?.canonical_title).localeCompare(String(right?.canonical_title))
  );
};
const orderedComponent = (members: string[]) => {
  const ordered: string[] = [];
  const remaining = new Set(members);
  while (remaining.size) {
    const next = [...remaining]
      .filter(
        (id) =>
          !sequelRelations.some(
            (relation) =>
              remaining.has(String(relation.source_work_id)) &&
              String(relation.target_work_id) === id,
          ),
      )
      .sort(compareWorks)[0];
    if (!next) break;
    ordered.push(next);
    remaining.delete(next);
  }
  return [...ordered, ...[...remaining].sort(compareWorks)];
};
const groups = [...components.values()]
  .filter((members) => members.length > 1)
  .map((members) => {
    const ordered = orderedComponent(members);
    const root =
      ordered.find((id) => workById.get(id)?.kind !== "movie" && !incoming.has(id)) ??
      ordered.find((id) => !incoming.has(id)) ??
      ordered[0];
    if (!root) throw new Error("Could not determine a franchise root");
    return { root, members: [root, ...ordered.filter((id) => id !== root)] };
  });

const parseMetadata = (work: Row) => {
  try {
    return typeof work.metadata === "string"
      ? (JSON.parse(work.metadata) as Record<string, unknown>)
      : (work.metadata as Record<string, unknown>);
  } catch {
    return {};
  }
};
const mergeEditorial = (values: string[]) => {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique.sort((left, right) => right.length - left.length)[0] ?? null;
};

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const targetTitles = await sql`select id, canonical_title, release_year from titles`;
const targetBySource = new Map<string, string>();
for (const work of works) {
  const target = targetTitles.find(
    (title) =>
      title.canonical_title === work.canonical_title &&
      (title.release_year === work.release_year || work.release_year == null),
  );
  if (target) targetBySource.set(String(work.id), String(target.id));
}
const consolidated: Array<{ title: string; installments: string[] }> = [];

await sql.begin(async (tx) => {
  const mergedTarget = new Map<string, string>();
  for (const group of groups) {
    const rootTargetId = targetBySource.get(group.root);
    const presentMembers = group.members.filter((id) => targetBySource.has(id));
    if (!rootTargetId) continue;
    const sourceMembers = group.members.map((id) => workById.get(id) as Row);
    const warnings = mergeEditorial(
      sourceMembers.flatMap((work) => {
        const value = parseMetadata(work)?.contentWarnings;
        return typeof value === "string" ? [value] : [];
      }),
    );
    const notes = mergeEditorial(
      sourceMembers.flatMap((work) => {
        const value = parseMetadata(work)?.analysisNotes;
        return typeof value === "string" ? [value] : [];
      }),
    );
    await tx`update titles set release_year=${Math.min(...sourceMembers.map((work) => Number(work.release_year ?? 9999)))}, content_warnings=${warnings}, analysis_notes=${notes}, updated_at=now() where id=${rootTargetId}`;
    if (presentMembers.length < 2) continue;
    for (const id of presentMembers)
      mergedTarget.set(targetBySource.get(id) as string, rootTargetId);
    const presentSourceMembers = presentMembers.map((id) => workById.get(id) as Row);

    let temporaryPosition = 10_000;
    const movedInstallments: Array<{ id: string; sourceWork: Row }> = [];
    for (const sourceId of presentMembers) {
      const memberTargetId = targetBySource.get(sourceId) as string;
      const sourceWork = workById.get(sourceId) as Row;
      const installments =
        await tx`select id from installments where title_id=${memberTargetId} order by position`;
      for (const installment of installments) {
        temporaryPosition++;
        await tx`update installments set title_id=${rootTargetId}, position=${temporaryPosition}, title=case when kind='movie' then ${String(sourceWork.canonical_title)} else title end where id=${installment.id}`;
        await tx`insert into media_asset_assignments (asset_id, role, installment_id, is_primary)
          select x.asset_id, 'poster', ${installment.id}, true from media_asset_assignments x
          where x.title_id=${memberTargetId} and x.role='poster' and x.is_primary
            and not exists (select 1 from media_asset_assignments own where own.installment_id=${installment.id} and own.role='poster' and own.is_primary)
          on conflict do nothing`;
        movedInstallments.push({ id: String(installment.id), sourceWork });
      }
      if (memberTargetId === rootTargetId) continue;
      for (const [lookup, link] of [
        ["title_genres", "title_genres"],
        ["title_tones", "title_tones"],
        ["title_tags", "title_tags"],
        ["title_countries", "title_countries"],
      ] as const)
        await tx`insert into ${tx(link)} (title_id, value_id) select ${rootTargetId}, value_id from ${tx(lookup)} where title_id=${memberTargetId} on conflict do nothing`;
      await tx`insert into contributions (title_id, entity_id, role_id, position, is_primary) select ${rootTargetId}, entity_id, role_id, position, is_primary from contributions where title_id=${memberTargetId} on conflict do nothing`;
      await tx`insert into title_aliases (title_id, title, language, script, is_preferred) select ${rootTargetId}, title, language, script, false from title_aliases where title_id=${memberTargetId} on conflict do nothing`;
      await tx`insert into title_aliases (title_id, title, is_preferred) values (${rootTargetId}, ${String(sourceWork.canonical_title)}, false) on conflict do nothing`;
      await tx`update external_identities set title_id=${rootTargetId} where title_id=${memberTargetId}`;
    }
    for (const [index, installment] of movedInstallments.entries())
      await tx`update installments set position=${index + 1} where id=${installment.id}`;
    for (const sourceId of presentMembers.filter((id) => id !== group.root)) {
      const memberTargetId = targetBySource.get(sourceId) as string;
      await tx`delete from titles where id=${memberTargetId}`;
    }
    consolidated.push({
      title: String(workById.get(group.root)?.canonical_title),
      installments: presentSourceMembers.map((work) => String(work.canonical_title)),
    });
  }

  if (mergedTarget.size) {
    await tx`delete from title_relations`;
    const relationKeys = new Set<string>();
    for (const relation of rows("work_relations")) {
      const originalSource = targetBySource.get(String(relation.source_work_id));
      const originalTarget = targetBySource.get(String(relation.target_work_id));
      if (!originalSource || !originalTarget) continue;
      const sourceId = mergedTarget.get(originalSource) ?? originalSource;
      const targetId = mergedTarget.get(originalTarget) ?? originalTarget;
      if (sourceId === targetId) continue;
      const key = `${sourceId}:${targetId}:${relation.relation_type}`;
      if (relationKeys.has(key)) continue;
      relationKeys.add(key);
      await tx`insert into title_relations (source_title_id, target_title_id, kind, notes) values (${sourceId}, ${targetId}, ${relation.relation_type as string}, ${String(relation.notes ?? "")}) on conflict do nothing`;
    }
  }
});

source.close();
await sql.end();
console.log(JSON.stringify({ groups: consolidated.length, consolidated }, null, 2));
