import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

describe("award ceremony CRUD", () => {
  const orgSlug = `ceremony-test-org-${randomUUID().slice(0, 8)}`;
  let organizationId = "";

  afterAll(async () => {
    if (organizationId)
      await database().client`delete from award_organizations where id=${organizationId}`;
  });

  it("sets up a test organization", async () => {
    const [row] = await database().client`
      insert into award_organizations (slug, name_ar) values (${orgSlug}, ${"جهة اختبار الحفلات"})
      returning id`;
    organizationId = String(assertDefined(row, "expected an inserted organization").id);
    expect(organizationId).toBeTruthy();
  });

  it("creates, updates, and deletes a ceremony, and it appears in the awards document", async () => {
    const year = 1999 + Math.floor(Math.random() * 50);
    const createResponse = await app.request("/api/v1/admin/awards/ceremonies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, year, label: String(year) }),
    });
    expect(createResponse.status).toBe(201);
    const { id } = (await createResponse.json()) as { id: string };
    expect(id).toBeTruthy();

    const docResponse = await app.request("/api/v1/admin/awards");
    const doc = (await docResponse.json()) as {
      ceremonies: Array<{ id: string; organizationId: string; year: number; label: string }>;
    };
    const found = doc.ceremonies.find((ceremony) => ceremony.id === id);
    expect(found).toBeDefined();
    expect(found?.year).toBe(year);

    const updateResponse = await app.request(`/api/v1/admin/awards/ceremonies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        organizationId,
        year,
        edition: 5,
        label: "دورة خاصة",
        heldOn: null,
        sourceUrl: null,
      }),
    });
    expect(updateResponse.status).toBe(200);

    const [row] = await database().client`
      select label, edition from award_ceremonies where id=${id}`;
    expect(row?.label).toBe("دورة خاصة");
    expect(row?.edition).toBe(5);

    const deleteResponse = await app.request(`/api/v1/admin/awards/ceremonies/${id}`, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ deleted: 1 });

    const [gone] = await database().client`select id from award_ceremonies where id=${id}`;
    expect(gone).toBeUndefined();
  });

  it("deleting a ceremony clears (not cascades) the ceremony link on its recognitions", async () => {
    const sql = database().client;
    const [category] = await sql`
      insert into award_categories (organization_id, slug, name_ar)
      values (${organizationId}, 'best-test', 'أفضل اختبار') returning id`;
    const [title] = await sql`
      insert into titles (canonical_title, sort_title) values ('Ceremony FK Test', 'ceremony fk test')
      returning id`;
    const categoryId = String(assertDefined(category, "expected category").id);
    const titleId = String(assertDefined(title, "expected title").id);
    try {
      const year = 2001;
      const createResponse = await app.request("/api/v1/admin/awards/ceremonies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, year, label: String(year) }),
      });
      const { id: ceremonyId } = (await createResponse.json()) as { id: string };

      const [recognition] = await sql`
        insert into award_recognitions
          (title_id, organization_id, category_id, ceremony_id, organization_slug,
            organization_name, category, year, result)
        values (${titleId}, ${organizationId}, ${categoryId}, ${ceremonyId}, ${orgSlug},
          'جهة اختبار الحفلات', 'أفضل اختبار', ${year}, 'winner')
        returning id`;
      const recognitionId = String(assertDefined(recognition, "expected recognition").id);

      await app.request(`/api/v1/admin/awards/ceremonies/${ceremonyId}`, { method: "DELETE" });

      const [row] = await sql`
        select ceremony_id from award_recognitions where id=${recognitionId}`;
      expect(row?.ceremony_id).toBeNull();
    } finally {
      await sql`delete from titles where id=${titleId}`;
      await sql`delete from award_categories where id=${categoryId}`;
    }
  });
});
