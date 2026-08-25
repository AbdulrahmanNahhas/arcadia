import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

/**
 * `PUT /api/v1/admin/titles/:titleId/structure` deletes and recreates every installment on each
 * save (so seasons/episodes can be freely reordered), and `award_recognitions.installment_id`
 * cascades on that delete. Without special handling, resaving structure for any reason —
 * including just swapping an installment's poster — would silently wipe any award tied to one of
 * its installments. This covers the fix: an installment's award recognitions must survive a
 * structure resave the same way its installment_scores already did.
 */
describe("PUT /api/v1/admin/titles/:titleId/structure — award recognition survival", () => {
  const createdTitleIds: string[] = [];

  afterAll(async () => {
    const sql = database().client;
    if (createdTitleIds.length) await sql`delete from titles where id in ${sql(createdTitleIds)}`;
  });

  async function createTitleWithInstallment() {
    const sql = database().client;
    const title = `Structure Award Test ${randomUUID()}`;
    const [row] = await sql`
      insert into titles (canonical_title, sort_title, title_ar, summary)
      values (${title}, ${title.toLowerCase()}, ${title}, 'x') returning id`;
    const titleId = assertDefined(row, "expected the created title row").id as string;
    createdTitleIds.push(titleId);
    const [installment] = await sql`
      insert into installments (title_id, kind, position, title, status)
      values (${titleId}, 'movie', 0, ${title}, 'completed') returning id`;
    const installmentId = assertDefined(installment, "expected the created installment row")
      .id as string;
    return { titleId, installmentId };
  }

  async function putStructure(titleId: string, body: Record<string, unknown>) {
    return app.request(`/api/v1/admin/titles/${titleId}/structure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("keeps an installment-level award recognition across a routine structure resave", async () => {
    const { titleId, installmentId } = await createTitleWithInstallment();
    const sql = database().client;
    await sql`insert into award_recognitions
      (title_id, installment_id, organization_slug, organization_name, category, year, result, is_featured)
      values (${titleId}, ${installmentId}, 'academy-awards', 'أوسكار', 'Best Animated Feature', 2017, 'winner', true)`;

    const response = await putStructure(titleId, {
      seasons: [{ id: installmentId, title: "Renamed", installmentKind: "movie", position: 0 }],
      ungroupedUnits: [],
    });
    expect(response.status).toBe(200);

    const recognitions = await sql`
      select organization_slug, category, year, result, is_featured
      from award_recognitions where title_id=${titleId}`;
    expect(recognitions).toHaveLength(1);
    expect(recognitions[0]).toMatchObject({
      organization_slug: "academy-awards",
      category: "Best Animated Feature",
      year: 2017,
      result: "winner",
      is_featured: true,
    });
  });

  it("writes an installment's IMDb/TMDB ids and shows them back on the next read (player/torrent roadmap Phase 0)", async () => {
    const { titleId, installmentId } = await createTitleWithInstallment();
    const response = await putStructure(titleId, {
      seasons: [
        {
          id: installmentId,
          title: "Movie With An IMDb Id",
          installmentKind: "movie",
          position: 0,
          tmdbId: 129,
          imdbId: "tt1798709",
        },
      ],
      ungroupedUnits: [],
    });
    expect(response.status).toBe(200);

    const sql = database().client;
    const rows = await sql`select tmdb_id, imdb_id from installments where title_id=${titleId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tmdb_id).toBe(129);
    expect(rows[0]?.imdb_id).toBe("tt1798709");
  });

  it("preserves an installment's ids across a resave that doesn't mention them, the same way scores/awards survive", async () => {
    const { titleId, installmentId } = await createTitleWithInstallment();
    await database().client`update installments set imdb_id='tt0245429', tmdb_id=572154 where id=${installmentId}`;

    // A resave that renames the installment but never sends tmdbId/imdbId at all (e.g. an older
    // structure-editing surface, or a partial patch) must not null out ids it doesn't know about.
    const response = await putStructure(titleId, {
      seasons: [{ id: installmentId, title: "Renamed, ids untouched", position: 0 }],
      ungroupedUnits: [],
    });
    expect(response.status).toBe(200);

    const rows =
      await database().client`select imdb_id, tmdb_id from installments where title_id=${titleId}`;
    expect(rows[0]?.imdb_id).toBe("tt0245429");
    expect(rows[0]?.tmdb_id).toBe(572154);
  });

  it("carries a title-level award recognition (no installment_id) through untouched, as before", async () => {
    const { titleId, installmentId } = await createTitleWithInstallment();
    const sql = database().client;
    await sql`insert into award_recognitions
      (title_id, installment_id, organization_slug, organization_name, category, result)
      values (${titleId}, null, 'annie-awards', 'جوائز آني', 'Best Animated Feature', 'nominee')`;

    const response = await putStructure(titleId, {
      seasons: [
        { id: installmentId, title: "Renamed Again", installmentKind: "movie", position: 0 },
      ],
      ungroupedUnits: [],
    });
    expect(response.status).toBe(200);

    const recognitions = await sql`
      select installment_id from award_recognitions where title_id=${titleId}`;
    expect(recognitions).toHaveLength(1);
    expect(recognitions[0]?.installment_id).toBeNull();
  });
});
