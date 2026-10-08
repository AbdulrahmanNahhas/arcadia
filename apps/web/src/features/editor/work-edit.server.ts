import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { openDatabase, type TransactionSql } from "@arcadia/cli/db";
import { workApply, workDocument, workExport, type WorkDocument } from "@arcadia/cli/work";
import { z } from "zod";

import {
  documentChanges,
  documentRow,
  isJsonObject,
  equalValue,
  fieldKeys,
  projectionSchema,
  type JsonValue,
  type DocumentReview,
} from "./document-model";

const secret = randomBytes(32);
const rowWithId = documentRow.refine((row) => z.string().uuid().safeParse(row.id).success);
const planSchema = z.object({
  expiresAt: z.number(),
  records: z.array(
    z.object({
      id: z.string().uuid(),
      create: z.boolean().default(false),
      revision: z.string(),
      patch: rowWithId,
      after: z.string(),
    }),
  ),
});
type Plan = z.infer<typeof planSchema>;
export function revision(document: WorkDocument) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}
function ticket(plan: Plan) {
  const payload = Buffer.from(JSON.stringify(plan)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function readTicket(value: string) {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) throw new Error("المراجعة غير صالحة؛ أعد مراجعة المسودة.");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected))
    throw new Error("تغيّرت المراجعة أو انتهت جلسة الخادم؛ أعد المراجعة.");
  const plan = planSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  if (Date.now() > plan.expiresAt) throw new Error("انتهت صلاحية المراجعة؛ أعد المراجعة قبل الحفظ.");
  return plan;
}
export async function loadWorkSnapshots(ids: string[]) {
  const sql = openDatabase();
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    const result = [];
    for (const id of ids) {
      const document = await workExport(transaction, id);
      result.push({ document, revision: revision(document) });
    }
    return result;
  });
}
function guardKeys(raw: JsonValue, parsed: JsonValue, path = "") {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    raw.forEach((value, index) => guardKeys(value, parsed[index] ?? null, `${path}[${index}]`));
  } else if (isJsonObject(raw) && isJsonObject(parsed)) {
    for (const [key, value] of Object.entries(raw)) {
      if (!Object.hasOwn(parsed, key)) throw new Error(`حقل غير معروف: ${path}${key}`);
      guardKeys(value, parsed[key] ?? null, `${path}${key}.`);
    }
  }
}
function prepareStructure(patch: WorkDocument, current: WorkDocument) {
  const removed: string[] = [];
  if (!patch.installments) return removed;
  const ids = new Set<string>();
  for (const item of patch.installments) {
    const original = current.installments?.find((value) => value.id === item.id);
    if (item.id && !original)
      throw new Error("معرّف جزء لا ينتمي إلى العمل. اترك المعرّف فارغاً للأجزاء الجديدة.");
    item.id ??= randomUUID();
    if (ids.has(item.id)) throw new Error("معرّف جزء مكرر.");
    ids.add(item.id);
    const episodes = new Set<string>();
    for (const episode of item.episodes ?? []) {
      if (episode.id && !original?.episodes?.some((value) => value.id === episode.id))
        throw new Error("معرّف حلقة لا ينتمي إلى الجزء.");
      episode.id ??= randomUUID();
      if (episodes.has(episode.id)) throw new Error("معرّف حلقة مكرر.");
      episodes.add(episode.id);
    }
    if (item.episodes) {
      for (const episode of original?.episodes ?? [])
        if (episode.id && !episodes.has(episode.id)) removed.push(episode.id);
    }
  }
  if (current.installments?.some((value) => value.id && !ids.has(value.id)))
    throw new Error(
      "حذف الأجزاء يحتاج مراجعة مستقلة لحماية الحلقات وسجل المشاهدة. أعد الأجزاء المحذوفة إلى المسودة.",
    );
  return removed;
}
async function applyPatch(transaction: TransactionSql, patch: WorkDocument, create = false) {
  if (!create && patch.installments && patch.id) {
    const current = await workExport(transaction, patch.id);
    const retained = new Set(
      patch.installments.flatMap((item) => (item.episodes ?? []).map((episode) => episode.id)),
    );
    for (const item of current.installments ?? []) {
      if (!patch.installments.find((next) => next.id === item.id)?.episodes) continue;
      for (const episode of item.episodes ?? []) {
        if (!episode.id || retained.has(episode.id)) continue;
        await transaction`select id from episodes where id = ${episode.id} for update`;
        const linked = await episodeLinks(transaction, episode.id);
        if (linked.length)
          throw new Error(
            `لا يمكن حذف الحلقة ${episode.number}: ترتبط بسجلات محفوظة (${linked.map((row) => `${row.table}: ${row.count}`).join("، ")}).`,
          );
        await transaction`delete from episodes where id = ${episode.id}`;
      }
    }
  }
  const { id, ...creation } = patch;
  await workApply(
    openDatabase(),
    {
      positionals: [],
      repeated: new Map(),
      flags: new Map<string, string | boolean>([
        ["json", JSON.stringify(create ? creation : patch)],
        ["create-only", create],
        ["mode", "merge"],
      ]),
    },
    undefined,
    transaction,
    [
      "aliases",
      "trivia",
      "genres",
      "tones",
      "tags",
      "countries",
      "planets",
      "credits",
      "externalIds",
      "relations",
      "awards",
    ],
    create ? id : undefined,
  );
}
class Rehearsal extends Error {
  constructor(readonly review: DocumentReview) {
    super("rehearsal rollback");
  }
}
export async function prepareWorkReview(
  json: string,
  originals: { id: string; revision: string }[],
) {
  const projection = projectionSchema.parse(JSON.parse(json));
  if (new Set(projection.fields).size !== projection.fields.length)
    throw new Error("قائمة الحقول تتضمن تكراراً.");
  const revisions = new Map(originals.map((value) => [value.id, value.revision]));
  const seen = new Set<string>();
  const sql = openDatabase();
  try {
    await sql.begin("isolation level serializable", async (transaction) => {
      const plan: Plan = { expiresAt: Date.now() + 20 * 60 * 1000, records: [] };
      const review: DocumentReview = { ticket: "", expiresAt: plan.expiresAt, records: [] };
      const baseline = new Map<string, WorkDocument>();
      for (const raw of projection.records) {
        const id = z.string().uuid().parse(raw.id);
        const current = await workExport(transaction, id);
        if (revision(current) !== revisions.get(id))
          throw new Error("تغيّر العمل منذ تحميله. احتفظ بالمسودة وأعد تحميل النسخة الحالية.");
        baseline.set(id, current);
      }
      for (const raw of projection.records) {
        const id = z.string().uuid().parse(raw.id);
        if (!revisions.has(id) || seen.has(id))
          throw new Error("معرّف عمل غير محدد أو مكرر في المسودة.");
        seen.add(id);
        for (const key of Object.keys(raw))
          if (key !== "id" && !projection.fields.includes(z.enum(fieldKeys).parse(key)))
            throw new Error(`الحقل ${key} خارج نطاق التحرير.`);
        const current = baseline.get(id);
        if (!current) throw new Error("العمل غير موجود في نطاق التحرير.");
        const candidate = workDocument.partial().required({ id: true }).strict().parse(raw);
        guardKeys(raw, documentRow.parse(candidate));
        const patch: WorkDocument = { id, canonicalTitle: current.canonicalTitle };
        for (const key of projection.fields) {
          if (Object.hasOwn(candidate, key) && !equalValue(current[key], candidate[key]))
            Object.assign(patch, { [key]: candidate[key] });
        }
        prepareStructure(patch, current);
        if (patch.awards) {
          const awardIds = new Set<string>();
          for (const award of patch.awards) {
            if (award.id && !current.awards?.some((original) => original.id === award.id))
              throw new Error("معرّف جائزة لا ينتمي إلى العمل.");
            award.id ??= randomUUID();
            if (awardIds.has(award.id)) throw new Error("معرّف جائزة مكرر.");
            awardIds.add(award.id);
          }
        }
        if (patch.canonicalTitle === current.canonicalTitle && !Object.hasOwn(patch, "sortTitle"))
          patch.sortTitle = current.sortTitle;
        if (
          Object.keys(patch).length === 3 &&
          patch.canonicalTitle === current.canonicalTitle &&
          patch.sortTitle === current.sortTitle
        )
          continue;
        await applyPatch(transaction, patch);
        plan.records.push({
          id,
          create: false,
          revision: revision(current),
          patch: documentRow.parse(patch),
          after: "",
        });
      }
      for (const record of plan.records) {
        const current = baseline.get(record.id);
        if (!current) throw new Error("العمل غير موجود.");
        const after = await workExport(transaction, record.id);
        record.after = revision(after);
        const changes = documentChanges(documentRow.parse(current), documentRow.parse(after));
        if (changes.length)
          review.records.push({
            id: record.id,
            name: after.titleAr || after.canonicalTitle,
            changes,
          });
      }
      plan.records = plan.records.filter((record) => record.after !== record.revision);
      review.ticket = ticket(plan);
      throw new Rehearsal(review);
    });
  } catch (error) {
    if (error instanceof Rehearsal) return error.review;
    throw error;
  }
  throw new Error("تعذّر إعداد المراجعة.");
}
export async function commitWorkReview(value: string) {
  const plan = readTicket(value);
  if (!plan.records.length) throw new Error("لا توجد تغييرات للحفظ.");
  const sql = openDatabase();
  return sql.begin("isolation level serializable", async (transaction) => {
    for (const record of plan.records) {
      if (record.create) {
        const existing = await transaction`select id from titles where id = ${record.id}`;
        if (existing.length) throw new Error("حُفظ هذا العمل بالفعل؛ أعد تحميل الصفحة.");
        continue;
      }
      const current = await workExport(transaction, record.id);
      if (revision(current) !== record.revision)
        throw new Error("تغيّر أحد الأعمال بعد المراجعة. لم تُحفظ أي تغييرات؛ أعد المراجعة.");
    }
    for (const record of plan.records)
      await applyPatch(transaction, workDocument.parse(record.patch), record.create);
    for (const record of plan.records) {
      const after = await workExport(transaction, record.id);
      if (revision(after) !== record.after)
        throw new Error("نتيجة الحفظ تختلف عن المراجعة. لم تُحفظ أي تغييرات؛ أعد المراجعة.");
    }
    return {
      saved: plan.records.length,
      createdId: plan.records.find((record) => record.create)?.id ?? null,
    };
  });
}

async function episodeLinks(transaction: TransactionSql, id: string) {
  const queries = await transaction<{ table: string; query: string }[]>`
    select c.conrelid::regclass::text as "table",
      format('select count(*)::int as count from %s child where %s', c.conrelid::regclass,
        string_agg(format('to_jsonb(child)->%L is not distinct from $1::text::jsonb->%L', a.attname, b.attname), ' and ')) as query
    from pg_constraint c
    join lateral unnest(c.conkey, c.confkey) as keys(a, b) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = keys.a
    join pg_attribute b on b.attrelid = c.confrelid and b.attnum = keys.b
    where c.contype = 'f' and c.confrelid = 'episodes'::regclass
    group by c.oid, c.conrelid`;
  const [episode] = await transaction`select to_jsonb(e) as value from episodes e where id = ${id}`;
  if (!episode) throw new Error("الحلقة غير موجودة.");
  const result: { table: string; count: number }[] = [];
  for (const query of queries) {
    const [row] = await transaction.unsafe<{ count: number }[]>(query.query, [
      JSON.stringify(episode.value),
    ]);
    if (row?.count) result.push({ table: query.table, count: row.count });
  }
  return result;
}
export async function inspectEpisodeDeletion(workId: string, episodeId: string) {
  return openDatabase().begin("isolation level repeatable read read only", async (transaction) => {
    const rows =
      await transaction`select e.id from episodes e join installments i on i.id = e.installment_id where e.id = ${episodeId} and i.title_id = ${workId}`;
    if (!rows.length) throw new Error("الحلقة لا تنتمي إلى العمل.");
    return episodeLinks(transaction, episodeId);
  });
}

export function validateWorkDraft(json: string) {
  const raw = documentRow.parse(JSON.parse(json));
  const parsed = workDocument.strict().parse(raw);
  guardKeys(raw, documentRow.parse(parsed));
  return parsed;
}
export async function prepareNewWorkReview(json: string) {
  const patch = validateWorkDraft(json);
  if (patch.id) throw new Error("مسودة العمل الجديد لا تقبل معرّف عمل موجود.");
  patch.id = randomUUID();
  prepareStructure(patch, { canonicalTitle: patch.canonicalTitle });
  for (const award of patch.awards ?? []) {
    if (award.id) throw new Error("الجائزة الجديدة لا تقبل معرّف جائزة موجودة.");
    award.id = randomUUID();
  }
  try {
    await openDatabase().begin("isolation level serializable", async (transaction) => {
      await applyPatch(transaction, patch, true);
      const after = await workExport(transaction, patch.id ?? "");
      const expiresAt = Date.now() + 20 * 60 * 1000;
      const plan: Plan = {
        expiresAt,
        records: [
          {
            id: patch.id ?? "",
            create: true,
            revision: "new",
            patch: documentRow.parse(patch),
            after: revision(after),
          },
        ],
      };
      throw new Rehearsal({
        ticket: ticket(plan),
        expiresAt,
        records: [
          {
            id: plan.records[0]?.id ?? "",
            name: after.titleAr || after.canonicalTitle,
            changes: documentChanges({}, documentRow.parse(after)),
          },
        ],
      });
    });
  } catch (error) {
    if (error instanceof Rehearsal) return error.review;
    throw error;
  }
  throw new Error("تعذّر إعداد مراجعة العمل الجديد.");
}
