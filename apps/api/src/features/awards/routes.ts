import {
  awardOptionsSchema,
  createAwardCategorySchema,
  createAwardOrganizationSchema,
} from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
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

awardRoutes.use("/api/v1/admin/awards/*", async (context, next) => {
  if (!(await canEditAwards(context.req.raw.headers))) {
    return context.json({ message: "لا يملك هذا الحساب صلاحية تحرير الجوائز." }, 403);
  }
  await next();
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
  const [row] = await database().client`insert into award_organizations
    (slug, name_ar, name_en, website_url)
    values (${input.slug}, ${input.nameAr}, ${input.nameEn}, ${input.websiteUrl})
    on conflict (slug) do update set name_ar=excluded.name_ar,
      name_en=excluded.name_en, website_url=excluded.website_url, is_active=true,
      updated_at=now() returning id, slug, name_ar as "nameAr", name_en as "nameEn"`;
  return context.json(row, 201);
});

awardRoutes.post("/api/v1/admin/awards/categories", async (context) => {
  const parsed = createAwardCategorySchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات فئة الجائزة غير صالحة." }, 400);
  const input = parsed.data;
  const [row] = await database().client`insert into award_categories
    (organization_id, slug, name_ar, name_en)
    values (${input.organizationId}, ${input.slug}, ${input.nameAr}, ${input.nameEn})
    on conflict (organization_id, slug) do update set name_ar=excluded.name_ar,
      name_en=excluded.name_en, is_active=true, updated_at=now()
    returning id, slug, name_ar as "nameAr", name_en as "nameEn"`;
  return context.json(row, 201);
});
