import { openDatabase, type TransactionSql } from "@arcadia/cli/db";
import { z } from "zod";

import { workScoreSchema } from "@/features/scoring/score-model";
import { loadTitleScores } from "@/features/scoring/score.server";

import {
  catalogDetailInputSchema,
  catalogDetailSchema,
  catalogPageInputSchema,
  catalogPageSchema,
  changeCatalogContributionInputSchema,
  changeCatalogContributionResultSchema,
  movePlanetWorksInputSchema,
  movePlanetWorksResultSchema,
  type CatalogKind,
} from "./catalog-model";
import { rowSchema } from "./database-model";

const uuidSchema = z.string().uuid();
const pageSize = 50;
const catalogSqlRowSchema = z.object({
  row: rowSchema,
  image: z.string().nullable(),
  related_count: z.number().int(),
});
const sqlRecordRowSchema = z.object({ row: rowSchema });
const totalRowSchema = z.object({ total: z.number().int() });
const planetMemberSqlRowSchema = z.object({
  row: rowSchema,
  title_id: uuidSchema,
  title: z.string(),
  image: z.string().nullable(),
});
const contributionSqlRowSchema = planetMemberSqlRowSchema.extend({ role_label: z.string() });
const imageSqlRowSchema = z.object({ row: rowSchema, path: z.string() });
const relationSqlRowSchema = z.object({
  row: rowSchema,
  source_name: z.string(),
  target_name: z.string(),
});
const planetIdSqlRowSchema = z.object({ id: uuidSchema });
const collisionSqlRowSchema = z.object({ title_id: uuidSchema });
const foundSqlRowSchema = z.object({ found: z.literal(1) });
const jsonObjectSchema = z.record(z.string(), z.json());
type CatalogPageInput = z.input<typeof catalogPageInputSchema>;
type CatalogDetailInput = z.input<typeof catalogDetailInputSchema>;
type MovePlanetWorksInput = z.input<typeof movePlanetWorksInputSchema>;
type ChangeCatalogContributionInput = z.input<typeof changeCatalogContributionInputSchema>;

function parseRows<Schema extends z.ZodType>(schema: Schema, rows: z.input<Schema>[]) {
  return z.array(schema).parse(rows);
}

function entityKind(kind: CatalogKind) {
  return kind === "people" ? "person" : "organization";
}
function requireOne<T>(rows: readonly T[], message: string) {
  if (!rows[0]) throw new Error(message);
  return rows[0];
}

export async function loadCatalogPage(input: CatalogPageInput) {
  const { kind, offset, search, sort, imageFilter, planetFilter } =
    catalogPageInputSchema.parse(input);
  const sql = openDatabase();
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    let rows: z.infer<typeof catalogSqlRowSchema>[];
    let totals: z.infer<typeof totalRowSchema>[];
    if (kind === "planets") {
      rows = parseRows(
        catalogSqlRowSchema,
        await transaction`
        select to_jsonb(p) as row,
          null::text as image,
          (select count(*)::integer from title_planets tp where tp.planet_id = p.id) as related_count
        from planets p
        where (${search} = '' or p.name_ar ilike ${`%${search}%`} or coalesce(p.name_en, '') ilike ${`%${search}%`} or p.slug ilike ${`%${search}%`})
          and (${planetFilter} = 'all' or (${planetFilter} = 'active' and p.is_active) or (${planetFilter} = 'inactive' and not p.is_active))
        order by
          case when ${sort} = 'related' then (select count(*) from title_planets tp where tp.planet_id = p.id) end desc nulls last,
          case when ${sort} = 'updated' then p.updated_at end desc nulls last,
          case when ${sort} = 'name' then p.name_ar end asc nulls last,
          p.display_order, p.name_ar, p.id
      `,
      );
      totals = parseRows(
        totalRowSchema,
        await transaction`
        select count(*)::integer as total from planets p
        where (${search} = '' or p.name_ar ilike ${`%${search}%`} or coalesce(p.name_en, '') ilike ${`%${search}%`} or p.slug ilike ${`%${search}%`})
          and (${planetFilter} = 'all' or (${planetFilter} = 'active' and p.is_active) or (${planetFilter} = 'inactive' and not p.is_active))
      `,
      );
    } else {
      const kindValue = entityKind(kind);
      rows = parseRows(
        catalogSqlRowSchema,
        await transaction`
        select to_jsonb(e) as row,
          (select a.path from media_asset_assignments m join media_assets a on a.id = m.asset_id
            where m.entity_id = e.id order by m.is_primary desc,
              case m.role when 'profile' then 0 when 'logo' then 1 else 2 end, m.id limit 1) as image,
          (select count(distinct c.title_id)::integer from contributions c where c.entity_id = e.id) as related_count
        from entities e
        where e.kind = ${kindValue}
          and (${search} = '' or e.name ilike ${`%${search}%`} or e.sort_name ilike ${`%${search}%`}
            or exists (select 1 from entity_aliases ea where ea.entity_id = e.id and ea.alias ilike ${`%${search}%`}))
          and (${imageFilter} = 'all'
            or (${imageFilter} = 'with-image' and exists (select 1 from media_asset_assignments m where m.entity_id = e.id))
            or (${imageFilter} = 'without-image' and not exists (select 1 from media_asset_assignments m where m.entity_id = e.id)))
        order by
          case when ${sort} = 'related' then (select count(distinct c.title_id) from contributions c where c.entity_id = e.id) end desc nulls last,
          case when ${sort} = 'updated' then e.updated_at end desc nulls last,
          case when ${sort} = 'name' then e.sort_name end asc nulls last,
          e.sort_name, e.name, e.id limit ${pageSize} offset ${offset}
      `,
      );
      totals = parseRows(
        totalRowSchema,
        await transaction`
        select count(*)::integer as total from entities e
        where e.kind = ${kindValue}
          and (${search} = '' or e.name ilike ${`%${search}%`} or e.sort_name ilike ${`%${search}%`}
            or exists (select 1 from entity_aliases ea where ea.entity_id = e.id and ea.alias ilike ${`%${search}%`}))
          and (${imageFilter} = 'all'
            or (${imageFilter} = 'with-image' and exists (select 1 from media_asset_assignments m where m.entity_id = e.id))
            or (${imageFilter} = 'without-image' and not exists (select 1 from media_asset_assignments m where m.entity_id = e.id)))
      `,
      );
    }
    const total = z.number().int().parse(requireOne(totals, "تعذّر تحميل عدد السجلات.").total);
    return catalogPageSchema.parse({
      items: rows.map((item) => ({
        row: rowSchema.parse(item.row),
        image: z.string().nullable().parse(item.image),
        relatedCount: z.number().int().parse(item.related_count),
      })),
      total,
      offset,
    });
  });
}

export async function loadCatalogDetail(input: CatalogDetailInput) {
  const { kind, id, search } = catalogDetailInputSchema.parse(input);
  const sql = openDatabase();
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    let row: z.infer<typeof rowSchema>;
    if (kind === "planets") {
      const rows = parseRows(
        sqlRecordRowSchema,
        await transaction`select to_jsonb(p) as row from planets p where p.id = ${id}`,
      );
      row = rowSchema.parse(requireOne(rows, "الكوكب غير موجود.").row);
      const members = parseRows(
        planetMemberSqlRowSchema,
        await transaction`
        select to_jsonb(tp) as row, t.id as title_id, coalesce(t.title_ar, t.canonical_title) as title,
          (select a.path from media_asset_assignments m join media_assets a on a.id = m.asset_id
            where m.title_id = t.id and m.role = 'poster'
            order by m.is_primary desc, m.id limit 1) as image
        from title_planets tp join titles t on t.id = tp.title_id
        where tp.planet_id = ${id}
          and (${search} = '' or t.canonical_title ilike ${`%${search}%`} or coalesce(t.title_ar, '') ilike ${`%${search}%`})
        order by tp.featured_rank nulls last, t.sort_title, t.id
      `,
      );
      const totals = parseRows(
        totalRowSchema,
        await transaction`
        select count(*)::integer as total from title_planets tp join titles t on t.id = tp.title_id
        where tp.planet_id = ${id}
          and (${search} = '' or t.canonical_title ilike ${`%${search}%`} or coalesce(t.title_ar, '') ilike ${`%${search}%`})
      `,
      );
      const scores = await loadTitleScores(
        transaction,
        members.map((item) => item.title_id),
      );
      return catalogDetailSchema.parse({
        row,
        aliases: [],
        members: members.map((item) => ({
          row: rowSchema.parse(item.row),
          titleId: uuidSchema.parse(item.title_id),
          title: z.string().parse(item.title),
          image: z.string().nullable().parse(item.image),
          score: workScoreSchema.parse(scores.get(item.title_id)),
        })),
        memberTotal: z.number().int().parse(requireOne(totals, "تعذّر تحميل عدد الأعمال.").total),
        images: [],
        relations: [],
        offset: 0,
      });
    }

    const entityRows = parseRows(
      sqlRecordRowSchema,
      await transaction`select to_jsonb(e) as row from entities e where e.id = ${id} and e.kind = ${entityKind(kind)}`,
    );
    row = rowSchema.parse(requireOne(entityRows, "السجل غير موجود.").row);
    const [aliases, members, memberTotals, images, relations] = await Promise.all([
      transaction<
        z.infer<typeof sqlRecordRowSchema>[]
      >`select to_jsonb(ea) as row from entity_aliases ea where ea.entity_id = ${id} order by ea.language nulls last, ea.alias, ea.id`,
      transaction<z.infer<typeof contributionSqlRowSchema>[]>`
        select to_jsonb(c) as row, t.id as title_id, coalesce(t.title_ar, t.canonical_title) as title,
          (select a.path from media_asset_assignments m join media_assets a on a.id = m.asset_id
            where m.title_id = t.id and m.role = 'poster'
            order by m.is_primary desc, m.id limit 1) as image,
          r.label_ar as role_label
        from contributions c join titles t on t.id = c.title_id join roles r on r.id = c.role_id
        where c.entity_id = ${id}
          and (${search} = '' or t.canonical_title ilike ${`%${search}%`} or coalesce(t.title_ar, '') ilike ${`%${search}%`})
        order by c.position, t.sort_title, t.id, c.role_id
      `,
      transaction<z.infer<typeof totalRowSchema>[]>`
        select count(*)::integer as total from contributions c join titles t on t.id = c.title_id
        where c.entity_id = ${id}
          and (${search} = '' or t.canonical_title ilike ${`%${search}%`} or coalesce(t.title_ar, '') ilike ${`%${search}%`})
      `,
      transaction<z.infer<typeof imageSqlRowSchema>[]>`
        select to_jsonb(m) as row, a.path from media_asset_assignments m join media_assets a on a.id = m.asset_id
        where m.entity_id = ${id} order by m.is_primary desc, m.role, m.id
      `,
      transaction<z.infer<typeof relationSqlRowSchema>[]>`
        select to_jsonb(r) as row, source.name as source_name, target.name as target_name
        from organization_relations r join entities source on source.id = r.source_id
          join entities target on target.id = r.target_id
        where r.source_id = ${id} or r.target_id = ${id}
        order by r.relation_type, source.sort_name, target.sort_name, r.id
      `,
    ]);
    const contributionMembers = parseRows(contributionSqlRowSchema, members);
    const scores = await loadTitleScores(
      transaction,
      contributionMembers.map((item) => item.title_id),
    );
    return catalogDetailSchema.parse({
      row,
      aliases: parseRows(sqlRecordRowSchema, aliases).map((item) => rowSchema.parse(item.row)),
      members: contributionMembers.map((item) => ({
        row: rowSchema.parse(item.row),
        titleId: uuidSchema.parse(item.title_id),
        title: z.string().parse(item.title),
        image: z.string().nullable().parse(item.image),
        score: workScoreSchema.parse(scores.get(item.title_id)),
        roleLabel: z.string().parse(item.role_label),
      })),
      memberTotal: z
        .number()
        .int()
        .parse(requireOne(parseRows(totalRowSchema, memberTotals), "تعذّر تحميل عدد الأعمال.").total),
      images: parseRows(imageSqlRowSchema, images).map((item) => ({
        row: rowSchema.parse(item.row),
        path: z.string().parse(item.path),
      })),
      relations: parseRows(relationSqlRowSchema, relations).map((item) => ({
        row: rowSchema.parse(item.row),
        sourceName: z.string().parse(item.source_name),
        targetName: z.string().parse(item.target_name),
      })),
      offset: 0,
    });
  });
}

const planetWorkOriginalSchema = z.object({
  title_id: z.string().uuid(),
  planet_id: z.string().uuid(),
  featured_rank: z.number().int().nonnegative().nullable(),
});

export async function transferPlanetWorks(input: MovePlanetWorksInput) {
  const parsed = movePlanetWorksInputSchema.parse(input);
  if (parsed.sourcePlanetId === parsed.targetPlanetId) throw new Error("اختر كوكبين مختلفين.");
  const originals = parsed.originals;
  const titleIds = originals.map((item) => item.titleId);
  if (new Set(titleIds).size !== titleIds.length) throw new Error("تتضمن القائمة عملاً مكرراً.");
  const originalRanks = new Map(originals.map((item) => [item.titleId, item.featuredRank]));
  const sql = openDatabase();
  return sql.begin("isolation level serializable", async (transaction) => {
    const planetRows = parseRows(
      planetIdSqlRowSchema,
      await transaction`
      select id from planets where id in ${transaction([parsed.sourcePlanetId, parsed.targetPlanetId])} order by id for update
    `,
    );
    if (planetRows.length !== 2) throw new Error("تعذّر العثور على كوكب المصدر أو الوجهة.");

    const currentRows = parseRows(
      planetWorkOriginalSchema,
      await transaction`
      select title_id, planet_id, featured_rank from title_planets
      where planet_id = ${parsed.sourcePlanetId} and title_id in ${transaction(titleIds)}
      order by title_id for update
    `,
    );
    if (currentRows.length !== titleIds.length)
      throw new Error("تغيّرت عضوية بعض الأعمال؛ أعد تحميل القائمة.");
    for (const current of currentRows) {
      if (originalRanks.get(current.title_id) !== current.featured_rank)
        throw new Error("تغيّرت بيانات أحد الأعمال منذ تحميلها؛ أعد تحميل القائمة.");
    }

    const collisions = parseRows(
      collisionSqlRowSchema,
      await transaction`
      select title_id from title_planets where planet_id = ${parsed.targetPlanetId} and title_id in ${transaction(titleIds)}
    `,
    );
    if (collisions.length)
      throw new Error("بعض الأعمال موجودة مسبقاً في كوكب الوجهة؛ لم يُنقل أي عمل.");

    for (const before of currentRows) {
      const moved = parseRows(
        sqlRecordRowSchema,
        await transaction`
        update title_planets set planet_id = ${parsed.targetPlanetId}, featured_rank = null
        where title_id = ${before.title_id} and planet_id = ${parsed.sourcePlanetId}
        returning to_jsonb(title_planets) as row
      `,
      );
      const after = rowSchema.parse(requireOne(moved, "تعذّر نقل أحد الأعمال؛ أُلغيت العملية.").row);
      await writeAudit(transaction, before, after);
    }
    return movePlanetWorksResultSchema.parse({ moved: currentRows.length });
  });
}

type JsonValue = z.infer<typeof jsonObjectSchema>[string];
const jsonValueRecordSchema = z.record(z.string(), z.json());

function canonicalJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalJson);
  const record = jsonValueRecordSchema.safeParse(value);
  if (record.success)
    return Object.fromEntries(
      Object.entries(record.data)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJson(item)]),
    );
  return value;
}

export async function changeCatalogContribution(input: ChangeCatalogContributionInput) {
  const parsed = changeCatalogContributionInputSchema.parse(input);
  const sql = openDatabase();
  return sql.begin("isolation level serializable", async (transaction) => {
    const locked = parseRows(
      sqlRecordRowSchema,
      await transaction`
      select to_jsonb(c) as row from contributions c
      where c.title_id = ${parsed.original.title_id} and c.entity_id = ${parsed.original.entity_id}
        and c.role_id = ${parsed.original.role_id}
      for update
    `,
    );
    const current = rowSchema.parse(requireOne(locked, "لم تعد هذه المساهمة موجودة.").row);
    if (JSON.stringify(canonicalJson(current)) !== JSON.stringify(canonicalJson(parsed.original)))
      throw new Error("تغيّرت المساهمة منذ تحميلها؛ أعد تحميل السجل.");

    if (parsed.roleId !== parsed.original.role_id) {
      const collisions = parseRows(
        foundSqlRowSchema,
        await transaction`
        select 1 as found from contributions
        where title_id = ${parsed.original.title_id} and entity_id = ${parsed.original.entity_id}
          and role_id = ${parsed.roleId}
      `,
      );
      if (collisions.length) throw new Error("هذا الدور مسجل مسبقاً لهذا العمل والكيان.");
    }
    const changed = parseRows(
      sqlRecordRowSchema,
      await transaction`
      update contributions set role_id = ${parsed.roleId}, position = ${parsed.position}, is_primary = ${parsed.isPrimary}
      where title_id = ${parsed.original.title_id} and entity_id = ${parsed.original.entity_id}
        and role_id = ${parsed.original.role_id}
      returning to_jsonb(contributions) as row
    `,
    );
    const after = rowSchema.parse(requireOne(changed, "تعذّر تحديث المساهمة.").row);
    await transaction`
      insert into audit_logs(action, target_type, target_id, summary, changes)
      values (
        'local.update', 'contributions', ${`${parsed.original.title_id}:${parsed.original.entity_id}:${parsed.original.role_id}`},
        'Local dashboard administration', ${JSON.stringify({ before: current, after })}::jsonb
      )
    `;
    return changeCatalogContributionResultSchema.parse({ row: after });
  });
}

async function writeAudit(
  transaction: TransactionSql,
  before: z.infer<typeof planetWorkOriginalSchema>,
  after: z.infer<typeof rowSchema>,
) {
  const afterRow = rowSchema.parse(after);
  const beforeRow = rowSchema.parse({
    title_id: before.title_id,
    planet_id: before.planet_id,
    featured_rank: before.featured_rank,
  });
  await transaction`
    insert into audit_logs(action, target_type, target_id, summary, changes)
    values (
      'local.update', 'title_planets', ${`${before.title_id}:${before.planet_id}`},
      'Local dashboard administration', ${JSON.stringify({ before: beforeRow, after: afterRow })}::jsonb
    )
  `;
}
