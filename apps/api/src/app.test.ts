import { watchHistoryItemSchema } from "@arcadia/contracts";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { app } from "./app";
import { database } from "./database";
import { catalogIsPopulated } from "./test-support";

const installmentsByReleaseSchema = z.object({
  items: z.array(z.object({ releaseDate: z.string().nullable() })),
});
const installmentsByScoreSchema = z.object({
  items: z.array(z.object({ rating: z.number().nullable() })),
});
const titlesPageSchema = z.object({
  items: z.array(z.object({ id: z.string(), releaseStatus: z.string() })),
});
const installmentsPageSchema = z.object({
  items: z.array(z.object({ titleId: z.string(), status: z.string() })),
});
const titlesByQuerySchema = z.object({ items: z.array(z.object({ id: z.string() })) });

async function allPages<T>(mode: "titles" | "installments", schema: z.ZodType<{ items: T[] }>) {
  const items: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await app.request(`/api/v1/titles?mode=${mode}&limit=100&offset=${offset}`);
    const page = schema.parse(await response.json());
    items.push(...page.items);
    if (page.items.length < 100) return items;
  }
}
const installmentsByQuerySchema = z.object({
  items: z.array(z.object({ titleId: z.string() })),
});
const adminOverviewSchema = z.object({
  titles: z.number(),
  installments: z.number(),
  episodes: z.number(),
  scored_installments: z.number(),
});

const hasCatalog = await catalogIsPopulated();

describe("Arcadia API contract", () => {
  it("reports database readiness", async () => {
    const response = await app.request("/api/v1/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ready", version: "v2" });
  });

  it.skipIf(!hasCatalog)("publishes OpenAPI and browses imported titles", async () => {
    const document = await (await app.request("/openapi.json")).json();
    expect(document.paths["/api/v1/titles"]).toBeDefined();
    const response = await app.request("/api/v1/titles?mode=titles&limit=2");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("titles");
    expect(body.items.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasCatalog)(
    "sorts flattened installments by newest release and editorial score",
    async () => {
      const releaseResponse = await app.request(
        "/api/v1/titles?mode=installments&sort=release&limit=100",
      );
      const releaseBody = installmentsByReleaseSchema.parse(await releaseResponse.json());
      const dated = releaseBody.items.filter((item) => item.releaseDate);
      expect(dated).not.toHaveLength(0);
      expect(dated.map((item) => item.releaseDate)).toEqual(
        dated
          .toSorted((left, right) =>
            String(right.releaseDate).localeCompare(String(left.releaseDate)),
          )
          .map((item) => item.releaseDate),
      );

      const scoreResponse = await app.request(
        "/api/v1/titles?mode=installments&sort=score&limit=100",
      );
      const scoreBody = installmentsByScoreSchema.parse(await scoreResponse.json());
      const scored = scoreBody.items.filter((item) => item.rating !== null);
      expect(scored.map((item) => item.rating)).toEqual(
        scored
          .toSorted((left, right) => Number(right.rating) - Number(left.rating))
          .map((item) => item.rating),
      );
    },
  );

  it.skipIf(!hasCatalog)(
    "calculates upcoming titles from their announced installments",
    async () => {
      // The catalog outgrew a fixed number of pages once (216 titles, 344 installments), which
      // made this test miss rows and fail for no product reason — walk every page instead.
      const titles = await allPages("titles", titlesPageSchema);
      const installments = await allPages("installments", installmentsPageSchema);
      const announcedTitleIds = titles
        .filter((item) => item.releaseStatus === "upcoming")
        .map((item) => item.id);
      const announcedInstallmentTitleIds = new Set(
        installments.filter((item) => item.status === "announced").map((item) => item.titleId),
      );
      expect(announcedTitleIds.every((id) => announcedInstallmentTitleIds.has(id))).toBe(true);
    },
  );

  it.skipIf(!hasCatalog)("finds titles and their installments by linked studio name", async () => {
    const [match] = await database().client`
      select t.id as "titleId", e.name as "studioName"
      from titles t
      join contributions c on c.title_id=t.id
      join entities e on e.id=c.entity_id
      where not t.is_private and e.kind='organization'
      limit 1
    `;
    expect(match).toBeDefined();
    if (!match) throw new Error("Expected an organization linked to a public title");

    const studioName = String(match.studioName);
    const titleId = String(match.titleId);
    const titleResponse = await app.request(
      `/api/v1/titles?mode=titles&q=${encodeURIComponent(studioName)}&limit=100`,
    );
    const installmentResponse = await app.request(
      `/api/v1/titles?mode=installments&q=${encodeURIComponent(studioName)}&limit=100`,
    );
    const titleBody = titlesByQuerySchema.parse(await titleResponse.json());
    const installmentBody = installmentsByQuerySchema.parse(await installmentResponse.json());

    expect(titleBody.items.map((item) => item.id)).toContain(titleId);
    expect(installmentBody.items.map((item) => item.titleId)).toContain(titleId);
  });

  it.skipIf(!hasCatalog)("reports useful PostgreSQL v2 administrator metrics", async () => {
    const response = await app.request("/api/v1/admin/overview");
    expect(response.status).toBe(200);
    const metrics = adminOverviewSchema.parse(await response.json());
    expect(metrics.titles).toBeGreaterThan(0);
    expect(metrics.installments).toBeGreaterThanOrEqual(metrics.titles);
    expect(metrics.episodes).toBeGreaterThan(0);
    expect(metrics.scored_installments).toBeGreaterThan(0);
  });

  it("returns played activity as watch history rather than browsing history", async () => {
    const signIn = await app.request("/api/auth/sign-in/username", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "family", password: "ArcadiaFamily!2026" }),
    });
    const token = signIn.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    if (!token) throw new Error("Expected Better Auth to return a bearer token");

    try {
      const response = await app.request("/api/v1/me/watch-history", {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(watchHistoryItemSchema.array().safeParse(body).success).toBe(true);
    } finally {
      await app.request("/api/auth/sign-out", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    }
  });

  it("returns real validation, statistics, vocabularies, and media health", async () => {
    const [validation, statistics, vocabularies, media] = await Promise.all([
      app.request("/api/v1/admin/validation"),
      app.request("/api/v1/admin/statistics?visibility=all"),
      app.request("/api/v1/admin/vocabularies"),
      app.request("/api/v1/admin/media-assets?limit=5"),
    ]);
    expect(validation.status).toBe(200);
    expect(Array.isArray(await validation.json())).toBe(true);
    expect(statistics.status).toBe(200);
    expect((await statistics.json()).scoreCoverage).toBeDefined();
    expect(vocabularies.status).toBe(200);
    expect((await vocabularies.json()).length).toBeGreaterThan(0);
    expect(media.status).toBe(200);
    expect((await media.json()).items).toBeDefined();
  });

  it("deletes an unused media record when its physical file is already missing", async () => {
    const sql = database().client;
    const [asset] = await sql`insert into media_assets
      (path, sha256, mime_type, byte_size, width, height, original_filename)
      values ('/media/uploads/posters/missing-delete-test.png', ${`${"f".repeat(63)}e`},
        'image/png', 1, 1, 1, 'missing-delete-test.png') returning id`;
    expect(asset).toBeDefined();

    try {
      const response = await app.request(`/api/v1/admin/media-assets/${asset?.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: true });
      const [remaining] = await sql`select id from media_assets where id=${asset?.id}`;
      expect(remaining).toBeUndefined();
    } finally {
      await sql`delete from media_assets where id=${asset?.id}`;
    }
  });
});

afterAll(async () => database().client.end());
