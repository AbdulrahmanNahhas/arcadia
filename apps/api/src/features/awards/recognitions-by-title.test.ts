import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

describe("GET /api/v1/admin/awards/recognitions?titleId=", () => {
  const orgSlug = `by-title-test-org-${randomUUID().slice(0, 8)}`;
  let organizationId = "";
  let categoryId = "";
  let titleId = "";

  afterAll(async () => {
    if (titleId) await database().client`delete from titles where id=${titleId}`;
    if (organizationId)
      await database().client`delete from award_organizations where id=${organizationId}`;
  });

  it("sets up an organization, category, and title", async () => {
    const sql = database().client;
    const [org] = await sql`
      insert into award_organizations (slug, name_ar) values (${orgSlug}, 'جهة اختبار العنوان')
      returning id`;
    organizationId = String(assertDefined(org, "expected organization").id);
    const [category] = await sql`
      insert into award_categories (organization_id, slug, name_ar)
      values (${organizationId}, 'best-title-test', 'أفضل اختبار عنوان') returning id`;
    categoryId = String(assertDefined(category, "expected category").id);
    const [title] = await sql`
      insert into titles (canonical_title, sort_title)
      values ('Recognitions By Title Test', 'recognitions by title test') returning id`;
    titleId = String(assertDefined(title, "expected title").id);
  });

  it("requires a titleId query parameter", async () => {
    const response = await app.request("/api/v1/admin/awards/recognitions");
    expect(response.status).toBe(400);
  });

  it("returns only recognitions for the requested title, in the normalized admin shape", async () => {
    const createResponse = await app.request("/api/v1/admin/awards/recognitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        categoryId,
        titleId,
        installmentId: null,
        year: 2022,
        result: "nominee",
        isFeatured: false,
        sourceUrl: null,
        notes: null,
      }),
    });
    expect(createResponse.status).toBe(201);

    const response = await app.request(`/api/v1/admin/awards/recognitions?titleId=${titleId}`);
    expect(response.status).toBe(200);
    const rows = (await response.json()) as Array<{
      titleId: string;
      organizationId: string | null;
      categoryId: string | null;
      result: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.titleId).toBe(titleId);
    expect(rows[0]?.organizationId).toBe(organizationId);
    expect(rows[0]?.categoryId).toBe(categoryId);
  });
});
