import { validationIssueSchema } from "@arcadia/contracts";
import { z } from "zod";
import { database } from "../../database";
import { storedMediaExists } from "../../media-storage";

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/**
 * Every explicit data problem the admin can act on, in one list — what `/admin/validation`
 * shows and what the "validate" maintenance job counts. Each issue carries the page that fixes
 * it (`repairPath`) and whether the API can fix it alone (`autoRepairable`: only orphaned media
 * so far). Ambiguous editorial judgement is never auto-repaired.
 */
export async function collectValidationIssues(): Promise<ValidationIssue[]> {
  const sql = database().client;
  const issues: ValidationIssue[] = [];
  const metadata = await sql`select id, canonical_title, title_ar, summary from titles
    where title_ar is null or btrim(title_ar)='' or btrim(summary)=''`;
  for (const row of metadata)
    issues.push({
      id: `metadata:${row.id}`,
      severity: "warning",
      category: "metadata",
      entityType: "work",
      entityId: String(row.id),
      title: String(row.canonical_title),
      path: "title.metadata",
      message: !row.title_ar ? "العنوان العربي مفقود." : "الملخص مفقود.",
      action: "راجع الحقول التحريرية.",
      repairPath: `/admin/catalog/${row.id}`,
      autoRepairable: false,
    });
  const missingPosters = await sql`select id, canonical_title from titles t where not exists
    (select 1 from media_asset_assignments x where x.title_id=t.id and x.role='poster' and x.is_primary)`;
  for (const row of missingPosters)
    issues.push({
      id: `poster:${row.id}`,
      severity: "warning",
      category: "media",
      entityType: "work",
      entityId: String(row.id),
      title: String(row.canonical_title),
      path: "media.poster",
      message: "لا يوجد ملصق أساسي.",
      action: "اختر أصلاً موجوداً أو ارفع صورة.",
      repairPath: `/admin/catalog/${row.id}`,
      autoRepairable: false,
    });
  const orphanAssets =
    await sql`select id, path, deletion_error from media_assets a where not exists
    (select 1 from media_asset_assignments x where x.asset_id=a.id)`;
  for (const row of orphanAssets)
    issues.push({
      id: `asset-orphan:${row.id}`,
      severity: row.deletion_error ? "error" : "info",
      category: "media",
      entityType: "asset",
      entityId: String(row.id),
      title: String(row.path),
      path: "media.assignments",
      message: row.deletion_error ? String(row.deletion_error) : "ملف غير مستخدم.",
      action: "يمكن حذف الأصل غير المستخدم بأمان.",
      repairPath: "/admin/media",
      autoRepairable: !row.deletion_error,
    });
  const allAssets = await sql`select id, path from media_assets`;
  for (const row of allAssets)
    if (!(await storedMediaExists(String(row.path))))
      issues.push({
        id: `asset-missing:${row.id}`,
        severity: "error",
        category: "media",
        entityType: "asset",
        entityId: String(row.id),
        title: String(row.path),
        path: "media.file",
        message: "سجل الأصل موجود لكن الملف غير موجود على القرص.",
        action: "استبدل الملف أو احذف التعيينات بعد المراجعة.",
        repairPath: "/admin/media?health=missing",
        autoRepairable: false,
      });
  const inactiveTerms = await sql`
    select 'genres' as vocabulary, g.id, g.label_ar, count(x.title_id)::int as usage from genres g join title_genres x on x.value_id=g.id where not g.is_active group by g.id
    union all select 'tones', g.id, g.label_ar, count(x.title_id)::int from tones g join title_tones x on x.value_id=g.id where not g.is_active group by g.id
    union all select 'tags', g.id, g.label_ar, count(x.title_id)::int from tags g join title_tags x on x.value_id=g.id where not g.is_active group by g.id`;
  for (const row of inactiveTerms)
    issues.push({
      id: `inactive:${row.vocabulary}:${row.id}`,
      severity: "warning",
      category: "vocabulary",
      entityType: "vocabulary",
      entityId: String(row.id),
      title: String(row.label_ar),
      path: `${row.vocabulary}.isActive`,
      message: `مصطلح مؤرشف ما زال مستخدماً في ${row.usage} سجل.`,
      action: "استبدل المصطلح أو أعد تنشيطه.",
      repairPath: `/admin/vocabularies?vocabulary=${row.vocabulary}`,
      autoRepairable: false,
    });

  // Playability: a released film the player cannot resolve because it carries no IMDb/TMDB id.
  const unplayable = await sql`
    select i.id, i.title, t.id as title_id, t.canonical_title
    from installments i join titles t on t.id = i.title_id
    where i.kind in ('movie', 'special') and i.status <> 'announced'
      and i.release_date is not null and i.release_date <= current_date
      and i.imdb_id is null and i.tmdb_id is null
      and not (t.imdb_id is not null and (select count(*) from installments s where s.title_id = t.id and s.kind in ('movie','special')) = 1)
    order by t.canonical_title, i.position`;
  for (const row of unplayable)
    issues.push({
      id: `playability:${row.id}`,
      severity: "warning",
      category: "metadata",
      entityType: "installment",
      entityId: String(row.id),
      title: `${row.canonical_title} — ${row.title}`,
      path: "installment.imdbId",
      message: "فيلم صادر بلا معرّف IMDb أو TMDB — زر التشغيل معطّل.",
      action: "أدخل معرّف IMDb في بطاقة الجزء داخل نموذج العمل.",
      repairPath: `/admin/catalog/${row.title_id}`,
      autoRepairable: false,
    });
  // A season with no episodes shows an empty tab and nothing to play.
  const emptySeasons = await sql`
    select i.id, i.title, t.id as title_id, t.canonical_title
    from installments i join titles t on t.id = i.title_id
    where i.kind = 'season' and not exists (select 1 from episodes e where e.installment_id = i.id)
    order by t.canonical_title, i.position`;
  for (const row of emptySeasons)
    issues.push({
      id: `empty-season:${row.id}`,
      severity: "warning",
      category: "integrity",
      entityType: "installment",
      entityId: String(row.id),
      title: `${row.canonical_title} — ${row.title}`,
      path: "installment.episodes",
      message: "موسم بلا حلقات.",
      action: "أضف الحلقات من محرّر الحلقات أو اجلبها من TMDB.",
      repairPath: `/admin/catalog/${row.title_id}/episodes?installment=${row.id}`,
      autoRepairable: false,
    });
  return z.array(validationIssueSchema).parse(issues);
}
