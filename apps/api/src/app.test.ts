import { afterAll, describe, expect, it } from "vitest";
import { app } from "./app";
import { database } from "./database";

describe("Arcadia API contract", () => {
  it("reports database readiness", async () => {
    const response = await app.request("/api/v1/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ready", version: "v2" });
  });

  it("publishes OpenAPI and browses imported titles", async () => {
    const document = await (await app.request("/openapi.json")).json();
    expect(document.paths["/api/v1/titles"]).toBeDefined();
    const response = await app.request("/api/v1/titles?mode=titles&limit=2");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("titles");
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("sorts flattened installments by newest release and editorial score", async () => {
    const releaseResponse = await app.request(
      "/api/v1/titles?mode=installments&sort=release&limit=100",
    );
    const releaseBody = (await releaseResponse.json()) as {
      items: Array<{ releaseDate: string | null }>;
    };
    const dated = releaseBody.items.filter((item) => item.releaseDate);
    expect(dated).not.toHaveLength(0);
    expect(dated.map((item) => item.releaseDate)).toEqual(
      [...dated]
        .sort((left, right) => String(right.releaseDate).localeCompare(String(left.releaseDate)))
        .map((item) => item.releaseDate),
    );

    const scoreResponse = await app.request(
      "/api/v1/titles?mode=installments&sort=score&limit=100",
    );
    const scoreBody = (await scoreResponse.json()) as {
      items: Array<{ rating: number | null }>;
    };
    const scored = scoreBody.items.filter((item) => item.rating !== null);
    expect(scored.map((item) => item.rating)).toEqual(
      [...scored]
        .sort((left, right) => Number(right.rating) - Number(left.rating))
        .map((item) => item.rating),
    );
  });

  it("calculates upcoming titles from their announced installments", async () => {
    const [titlesResponse, moreTitlesResponse, ...installmentResponses] = await Promise.all([
      app.request("/api/v1/titles?mode=titles&limit=100"),
      app.request("/api/v1/titles?mode=titles&limit=100&offset=100"),
      app.request("/api/v1/titles?mode=installments&limit=100"),
      app.request("/api/v1/titles?mode=installments&limit=100&offset=100"),
      app.request("/api/v1/titles?mode=installments&limit=100&offset=200"),
    ]);
    const titlePages = (await Promise.all([
      titlesResponse.json(),
      moreTitlesResponse.json(),
    ])) as Array<{
      items: Array<{ id: string; releaseStatus: string }>;
    }>;
    const titles = titlePages.flatMap((page) => page.items);
    const installmentPages = (await Promise.all(
      installmentResponses.map((response) => response.json()),
    )) as Array<{ items: Array<{ titleId: string; status: string }> }>;
    const installments = installmentPages.flatMap((page) => page.items);
    const announcedTitleIds = titles
      .filter((item) => item.releaseStatus === "upcoming")
      .map((item) => item.id);
    const announcedInstallmentTitleIds = new Set(
      installments.filter((item) => item.status === "announced").map((item) => item.titleId),
    );
    expect(announcedTitleIds.every((id) => announcedInstallmentTitleIds.has(id))).toBe(true);
  });

  it("finds titles and their installments by linked studio name", async () => {
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
    const titleBody = (await titleResponse.json()) as { items: Array<{ id: string }> };
    const installmentBody = (await installmentResponse.json()) as {
      items: Array<{ titleId: string }>;
    };

    expect(titleBody.items.map((item) => item.id)).toContain(titleId);
    expect(installmentBody.items.map((item) => item.titleId)).toContain(titleId);
  });

  it("reports useful PostgreSQL v2 administrator metrics", async () => {
    const response = await app.request("/api/v1/admin/overview");
    expect(response.status).toBe(200);
    const metrics = (await response.json()) as {
      titles: number;
      installments: number;
      episodes: number;
      scored_installments: number;
    };
    expect(metrics.titles).toBeGreaterThan(0);
    expect(metrics.installments).toBeGreaterThanOrEqual(metrics.titles);
    expect(metrics.episodes).toBeGreaterThan(0);
    expect(metrics.scored_installments).toBeGreaterThan(0);
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
