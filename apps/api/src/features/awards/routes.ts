import { randomUUID } from "node:crypto";
import {
  adminAwardCategoryInputSchema,
  adminAwardCeremonyInputSchema,
  adminAwardOrganizationInputSchema,
  adminAwardRecognitionInputSchema,
  adminAwardRecognitionSchema,
  adminAwardsDocumentSchema,
  awardOptionsSchema,
  createAwardCategorySchema,
  createAwardOrganizationSchema,
  publicAwardsDocumentSchema,
} from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { getAuthSession, isTestAuthBypass } from "../../auth";
import { database } from "../../database";

async function canEditAwards(headers: Headers) {
  if (isTestAuthBypass()) return true;
  const session = await getAuthSession(headers);
  if (!session) return false;
  if (session.user.role === "owner") return true;
  if (session.user.role !== "editor") return false;
  const [capability] = await database().client`
    select 1 from accounts a join account_capabilities c on c.account_id=a.id
    where a.auth_user_id=${session.user.id} and c.capability='awards.edit'`;
  return Boolean(capability);
}

export const awardRoutes = new OpenAPIHono();

// Public, family-facing feed — any signed-in account (the global /api/v1/* middleware already
// requires a session). Only active organizations and non-private titles are exposed; this is the
// same "hard-exclude private" convention /api/v1/people and /api/v1/studios use, not the fuller
// per-account classification policy that title browsing applies.
awardRoutes.get("/api/v1/awards", async (context) => {
  const sql = database().client;
  const [organizations, recognitions] = await Promise.all([
    sql`select o.id, o.slug, o.name_ar as "nameAr", o.name_en as "nameEn",
      o.description, o.website_url as "websiteUrl", o.logo_path as "logoPath",
      (select count(*)::int from award_recognitions r join titles t on t.id=r.title_id
        where r.organization_id=o.id and r.result='winner' and t.is_private=false) as "winnerCount",
      (select count(*)::int from award_recognitions r join titles t on t.id=r.title_id
        where r.organization_id=o.id and r.result='nominee' and t.is_private=false) as "nomineeCount",
      (select count(distinct r.title_id)::int from award_recognitions r
        join titles t on t.id=r.title_id
        where r.organization_id=o.id and t.is_private=false) as "workCount"
      from award_organizations o where o.is_active=true order by o.name_ar`,
    sql`select r.id, r.organization_id as "organizationId", r.organization_slug as "organizationSlug",
      r.organization_name as "organizationName", r.category, r.year, r.result,
      r.is_featured as "isFeatured", r.title_id as "titleId", t.canonical_title as title,
      t.title_ar as "titleAr",
      -- Prefer the recognized installment's own poster (e.g. a specific season's art) and only
      -- fall back to the title's poster when the recognition isn't tied to one installment.
      coalesce(
        (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id
          where maa.installment_id=r.installment_id and maa.role='poster' and maa.is_primary
          limit 1),
        (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id
          where maa.title_id=t.id and maa.role='poster' and maa.is_primary limit 1)
      ) as "posterPath",
      r.installment_id as "installmentId", i.title as "installmentTitle"
      from award_recognitions r
      join titles t on t.id=r.title_id
      join award_organizations o on o.id=r.organization_id
      left join installments i on i.id=r.installment_id
      where t.is_private=false and o.is_active=true
      order by r.is_featured desc, r.year desc nulls last, r.organization_name, t.sort_title`,
  ]);
  return context.json(
    publicAwardsDocumentSchema.parse({
      organizations: organizations.filter((organization) => organization.workCount > 0),
      recognitions,
    }),
  );
});

awardRoutes.use("/api/v1/admin/awards/*", async (context, next) => {
  if (!(await canEditAwards(context.req.raw.headers))) {
    return context.json({ message: "لا يملك هذا الحساب صلاحية تحرير الجوائز." }, 403);
  }
  await next();
});

awardRoutes.get("/api/v1/admin/awards", async (context) => {
  const sql = database().client;
  const [organizations, categories, recognitions, ceremonies] = await Promise.all([
    sql`select o.id, o.slug, o.name_ar as "nameAr", o.name_en as "nameEn",
      o.description, o.website_url as "websiteUrl", o.logo_path as "logoPath",
      o.is_active as "isActive",
      (select count(*)::int from award_recognitions r where r.organization_id=o.id) as "recognitionCount",
      (select count(distinct r.title_id)::int from award_recognitions r where r.organization_id=o.id) as "workCount",
      (select count(*)::int from award_recognitions r where r.organization_id=o.id and r.result='winner') as "winnerCount",
      (select count(*)::int from award_recognitions r where r.organization_id=o.id and r.result='nominee') as "nomineeCount"
      from award_organizations o order by o.is_active desc, o.name_ar`,
    sql`select c.id, c.organization_id as "organizationId", c.slug,
      c.name_ar as "nameAr", c.name_en as "nameEn", c.description,
      c.is_active as "isActive",
      (select count(*)::int from award_recognitions r where r.category_id=c.id) as "recognitionCount"
      from award_categories c order by c.is_active desc, c.name_ar`,
    sql`select r.id, r.organization_id as "organizationId", r.category_id as "categoryId",
      r.title_id as "titleId", t.canonical_title as title, t.title_ar as "titleAr",
      t.is_private as "isPrivate", r.organization_slug as "organizationSlug",
      r.organization_name as "organizationName", r.category, r.year, r.result,
      r.is_featured as "isFeatured", r.installment_id as "installmentId",
      i.title as "installmentTitle", r.source_url as "sourceUrl", r.notes
      from award_recognitions r join titles t on t.id=r.title_id
      left join installments i on i.id=r.installment_id
      order by r.year desc nulls last, r.organization_name, r.category, t.sort_title`,
    sql`select id, organization_id as "organizationId", year, edition,
      label, held_on as "heldOn", source_url as "sourceUrl"
      from award_ceremonies order by organization_id, year desc`,
  ]);
  return context.json(
    adminAwardsDocumentSchema.parse({
      organizations: organizations.map((organization) => ({
        ...organization,
        categories: categories.filter((category) => category.organizationId === organization.id),
      })),
      recognitions,
      ceremonies,
    }),
  );
});

awardRoutes.post("/api/v1/admin/awards/ceremonies", async (context) => {
  const parsed = adminAwardCeremonyInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "بيانات الحفل غير صالحة.", issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const [row] = await database().client`insert into award_ceremonies
    (id, organization_id, year, edition, label, held_on, source_url)
    values (${input.id ?? randomUUID()}, ${input.organizationId}, ${input.year}, ${input.edition},
      ${input.label}, ${input.heldOn}, ${input.sourceUrl})
    on conflict (organization_id, year) do update set edition=excluded.edition,
      label=excluded.label, held_on=excluded.held_on, source_url=excluded.source_url,
      updated_at=now()
    returning id`;
  if (!row) return context.json({ message: "تعذّر حفظ الحفل." }, 500);
  return context.json({ id: String(row.id) }, 201);
});

awardRoutes.put("/api/v1/admin/awards/ceremonies/:ceremonyId", async (context) => {
  const parsed = adminAwardCeremonyInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "بيانات الحفل غير صالحة.", issues: parsed.error.issues }, 400);
  const ceremonyId = context.req.param("ceremonyId");
  if (parsed.data.id !== ceremonyId)
    return context.json({ message: "معرّف الحفل لا يطابق المسار." }, 409);
  const input = parsed.data;
  const [row] = await database().client`update award_ceremonies set
    organization_id=${input.organizationId}, year=${input.year}, edition=${input.edition},
    label=${input.label}, held_on=${input.heldOn}, source_url=${input.sourceUrl}, updated_at=now()
    where id=${ceremonyId} returning id`;
  if (!row) return context.json({ message: "الحفل غير موجود." }, 404);
  return context.json({ id: ceremonyId });
});

awardRoutes.delete("/api/v1/admin/awards/ceremonies/:ceremonyId", async (context) => {
  // Recognitions referencing this ceremony keep their organization/category/year — only the
  // ceremony_id link is cleared (FK is onDelete: set null), so deleting a ceremony record never
  // orphans or removes any award recognition.
  const result = await database().client`delete from award_ceremonies
    where id=${context.req.param("ceremonyId")}`;
  if (!result.count) return context.json({ message: "الحفل غير موجود." }, 404);
  return context.json({ deleted: result.count });
});

awardRoutes.put("/api/v1/admin/awards/organizations/:organizationId", async (context) => {
  const parsed = adminAwardOrganizationInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json(
      { message: "بيانات الجهة المانحة غير صالحة.", issues: parsed.error.issues },
      400,
    );
  if (parsed.data.id !== context.req.param("organizationId"))
    return context.json({ message: "معرّف الجهة لا يطابق المسار." }, 409);
  const input = parsed.data;
  const sql = database().client;
  const [updated] = await sql`update award_organizations set slug=${input.slug},
    name_ar=${input.nameAr}, name_en=${input.nameEn}, description=${input.description},
    website_url=${input.websiteUrl}, logo_path=${input.logoPath}, is_active=${input.isActive},
    updated_at=now() where id=${input.id} returning id`;
  if (!updated) return context.json({ message: "الجهة المانحة غير موجودة." }, 404);
  await sql`update award_recognitions set organization_slug=${input.slug},
    organization_name=${input.nameAr}, updated_at=now() where organization_id=${input.id}`;
  return context.json({ id: input.id });
});

awardRoutes.delete("/api/v1/admin/awards/organizations/:organizationId", async (context) => {
  const organizationId = context.req.param("organizationId");
  const result = await database().client.begin(async (transaction) => {
    const recognitions = await transaction`delete from award_recognitions
      where organization_id=${organizationId}`;
    const organizations = await transaction`delete from award_organizations
      where id=${organizationId}`;
    return { deleted: organizations.count, deletedRecognitions: recognitions.count };
  });
  if (!result.deleted) return context.json({ message: "الجهة المانحة غير موجودة." }, 404);
  return context.json(result);
});

awardRoutes.put("/api/v1/admin/awards/categories/:categoryId", async (context) => {
  const parsed = adminAwardCategoryInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json(
      { message: "بيانات فئة الجائزة غير صالحة.", issues: parsed.error.issues },
      400,
    );
  if (parsed.data.id !== context.req.param("categoryId"))
    return context.json({ message: "معرّف الفئة لا يطابق المسار." }, 409);
  const input = parsed.data;
  const sql = database().client;
  const [updated] = await sql`update award_categories set slug=${input.slug},
    name_ar=${input.nameAr}, name_en=${input.nameEn}, description=${input.description},
    is_active=${input.isActive}, updated_at=now()
    where id=${input.id} and organization_id=${input.organizationId} returning id`;
  if (!updated) return context.json({ message: "فئة الجائزة غير موجودة." }, 404);
  await sql`update award_recognitions set category=${input.nameAr}, updated_at=now()
    where category_id=${input.id}`;
  return context.json({ id: input.id });
});

awardRoutes.delete("/api/v1/admin/awards/categories/:categoryId", async (context) => {
  const categoryId = context.req.param("categoryId");
  const result = await database().client.begin(async (transaction) => {
    const recognitions =
      await transaction`delete from award_recognitions where category_id=${categoryId}`;
    const categories = await transaction`delete from award_categories where id=${categoryId}`;
    return { deleted: categories.count, deletedRecognitions: recognitions.count };
  });
  if (!result.deleted) return context.json({ message: "فئة الجائزة غير موجودة." }, 404);
  return context.json(result);
});

/**
 * Powers the title editor's Awards tab (Stage 2) — that surface only needs one title's
 * recognitions, not the whole `GET /admin/awards` document (every title's, across every
 * organization). Same normalized, id-based shape as the standalone awards page uses; this is
 * the piece that made a shared, immediate-save recognition component possible.
 */
awardRoutes.get("/api/v1/admin/awards/recognitions", async (context) => {
  const titleId = context.req.query("titleId");
  if (!titleId) return context.json({ message: "المعرّف titleId مطلوب." }, 400);
  const rows = await database().client`select r.id, r.organization_id as "organizationId",
    r.category_id as "categoryId", r.title_id as "titleId", t.canonical_title as title,
    t.title_ar as "titleAr", t.is_private as "isPrivate",
    r.organization_slug as "organizationSlug", r.organization_name as "organizationName",
    r.category, r.year, r.result, r.is_featured as "isFeatured",
    r.installment_id as "installmentId", i.title as "installmentTitle",
    r.source_url as "sourceUrl", r.notes
    from award_recognitions r join titles t on t.id=r.title_id
    left join installments i on i.id=r.installment_id
    where r.title_id=${titleId}
    order by r.year desc nulls last, r.organization_name, r.category`;
  return context.json(z.array(adminAwardRecognitionSchema).parse(rows));
});

awardRoutes.post("/api/v1/admin/awards/recognitions", async (context) => {
  const parsed = adminAwardRecognitionInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "بيانات التكريم غير صالحة.", issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const sql = database().client;
  const [resolved] = await sql`select o.slug as organization_slug, o.name_ar as organization_name,
    c.name_ar as category_name
    from award_organizations o join award_categories c on c.organization_id=o.id
    where o.id=${input.organizationId} and c.id=${input.categoryId}`;
  if (!resolved) return context.json({ message: "الجهة والفئة غير متطابقتين." }, 400);
  if (input.installmentId) {
    const [installment] = await sql`select id from installments
      where id=${input.installmentId} and title_id=${input.titleId}`;
    if (!installment) return context.json({ message: "الجزء لا يتبع العمل المحدد." }, 400);
  }
  if (input.isFeatured)
    await sql`update award_recognitions set is_featured=false, updated_at=now()
      where title_id=${input.titleId} and id<>${input.id ?? "00000000-0000-0000-0000-000000000000"}`;
  const [ceremony] = input.year
    ? await sql`insert into award_ceremonies (organization_id, year, label)
      values (${input.organizationId}, ${input.year}, ${String(input.year)})
      on conflict (organization_id, year) do update set updated_at=now() returning id`
    : [undefined];
  const [row] = await sql`insert into award_recognitions
    (id, title_id, installment_id, organization_id, category_id, ceremony_id,
      organization_slug, organization_name, category, year, result, is_featured,
      source_url, notes)
    values (${input.id ?? randomUUID()}, ${input.titleId}, ${input.installmentId},
      ${input.organizationId}, ${input.categoryId}, ${ceremony?.id ?? null},
      ${resolved.organization_slug}, ${resolved.organization_name}, ${resolved.category_name},
      ${input.year}, ${input.result}, ${input.isFeatured}, ${input.sourceUrl}, ${input.notes})
    on conflict (id) do update set title_id=excluded.title_id,
      installment_id=excluded.installment_id, organization_id=excluded.organization_id,
      category_id=excluded.category_id, ceremony_id=excluded.ceremony_id,
      organization_slug=excluded.organization_slug, organization_name=excluded.organization_name,
      category=excluded.category, year=excluded.year, result=excluded.result,
      is_featured=excluded.is_featured, source_url=excluded.source_url,
      notes=excluded.notes, updated_at=now() returning id`;
  if (!row) return context.json({ message: "تعذر حفظ التكريم." }, 500);
  return context.json({ id: String(row.id) }, input.id ? 200 : 201);
});

awardRoutes.delete("/api/v1/admin/awards/recognitions/:recognitionId", async (context) => {
  const result = await database().client`delete from award_recognitions
    where id=${context.req.param("recognitionId")}`;
  if (!result.count) return context.json({ message: "التكريم غير موجود." }, 404);
  return context.json({ deleted: result.count });
});

awardRoutes.get("/api/v1/admin/awards/options", async (context) => {
  const rows = await database().client`
    select o.id, o.slug, o.name_ar as "nameAr", o.name_en as "nameEn",
      o.website_url as "websiteUrl",
      coalesce(json_agg(json_build_object(
        'id', c.id, 'slug', c.slug, 'nameAr', c.name_ar, 'nameEn', c.name_en
      ) order by c.name_ar) filter (where c.id is not null), '[]'::json) as categories
    from award_organizations o
    left join award_categories c on c.organization_id=o.id and c.is_active
    where o.is_active group by o.id order by o.name_ar`;
  return context.json(awardOptionsSchema.parse(rows));
});

awardRoutes.post("/api/v1/admin/awards/organizations", async (context) => {
  const parsed = createAwardOrganizationSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات الجهة المانحة غير صالحة." }, 400);
  const input = parsed.data;
  const sql = database().client;
  // Insert-if-new only — a slug collision must never silently revive/overwrite an existing
  // (possibly archived) organization. The caller decides whether to reactivate it.
  const [row] = await sql`insert into award_organizations
    (slug, name_ar, name_en, website_url)
    values (${input.slug}, ${input.nameAr}, ${input.nameEn}, ${input.websiteUrl})
    on conflict (slug) do nothing
    returning id, slug, name_ar as "nameAr", name_en as "nameEn"`;
  if (row) return context.json(row, 201);
  const [existing] = await sql`select id, slug, name_ar as "nameAr", name_en as "nameEn",
    is_active as "isActive" from award_organizations where slug=${input.slug}`;
  return context.json(
    {
      message: existing?.isActive
        ? "توجد جهة مانحة بهذا المعرّف بالفعل."
        : "توجد جهة مانحة غير مُفعّلة بهذا المعرّف — أعد تفعيلها من صفحة الجوائز بدلاً من إنشائها من جديد.",
      existing,
    },
    409,
  );
});

awardRoutes.post("/api/v1/admin/awards/categories", async (context) => {
  const parsed = createAwardCategorySchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات فئة الجائزة غير صالحة." }, 400);
  const input = parsed.data;
  const sql = database().client;
  // Same insert-if-new rule as organizations above — no silent revive-by-slug.
  const [row] = await sql`insert into award_categories
    (organization_id, slug, name_ar, name_en)
    values (${input.organizationId}, ${input.slug}, ${input.nameAr}, ${input.nameEn})
    on conflict (organization_id, slug) do nothing
    returning id, slug, name_ar as "nameAr", name_en as "nameEn"`;
  if (row) return context.json(row, 201);
  const [existing] = await sql`select id, slug, name_ar as "nameAr", name_en as "nameEn",
    is_active as "isActive" from award_categories
    where organization_id=${input.organizationId} and slug=${input.slug}`;
  return context.json(
    {
      message: existing?.isActive
        ? "توجد فئة بهذا المعرّف بالفعل ضمن هذه الجهة."
        : "توجد فئة غير مُفعّلة بهذا المعرّف ضمن هذه الجهة — أعد تفعيلها بدلاً من إنشائها من جديد.",
      existing,
    },
    409,
  );
});
