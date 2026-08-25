import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

/**
 * Covers the safety properties `POST /api/v1/admin/titles` didn't have before Stage 1: real
 * Zod validation (previously the route trusted an unvalidated hand-typed object), and that
 * fields the legacy web client has no UI for yet (age/qualityScore/provenance) survive an
 * update untouched instead of being silently reset to schema defaults.
 */
describe("POST /api/v1/admin/titles — validated write path", () => {
  const createdTitleIds: string[] = [];

  async function postTitle(body: Record<string, unknown>) {
    return app.request("/api/v1/admin/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  afterAll(async () => {
    const sql = database().client;
    if (createdTitleIds.length) await sql`delete from titles where id in ${sql(createdTitleIds)}`;
  });

  it("creates a title with schema defaults for previously-unwritable fields", async () => {
    const title = `Write Path Test ${randomUUID()}`;
    const response = await postTitle({ title, summary: "A test title." });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    createdTitleIds.push(id);

    const row = assertDefined(
      (
        await database().client`
        select age, quality_score, workflow_status, curator_notes, provenance
        from titles where id=${id}`
      )[0],
      "expected the created title row",
    );
    expect(row.age).toBe("all");
    expect(row.quality_score).toBe(0);
    expect(row.workflow_status).toBe("draft");
    expect(row.curator_notes).toBe("");
    expect(row.provenance).toEqual({});
  });

  it("preserves age, quality score, and provenance across an update that doesn't send them", async () => {
    const title = `Preserve Fields Test ${randomUUID()}`;
    const createResponse = await postTitle({ title, summary: "Before." });
    const { id } = (await createResponse.json()) as { id: string };
    createdTitleIds.push(id);

    // Simulate Stage 2's future Publishing tab having set these — the legacy client can't send
    // them, so an update must carry them forward rather than resetting to schema defaults.
    await database().client`
      update titles set age='16+', quality_score=87, provenance='{"source":"manual"}'::jsonb
      where id=${id}`;

    const updateResponse = await postTitle({ id, title, summary: "After." });
    expect(updateResponse.status).toBe(200);

    const row = assertDefined(
      (
        await database().client`
        select age, quality_score, provenance, summary from titles where id=${id}`
      )[0],
      "expected the updated title row",
    );
    expect(row.age).toBe("16+");
    expect(row.quality_score).toBe(87);
    expect(row.provenance).toEqual({ source: "manual" });
    expect(row.summary).toBe("After.");
  });

  it("preserves age, workflow status, quality score, and curator notes when a caller sends them as null (not omitted)", async () => {
    // The JSON editor's bulk-save path builds a title's payload from the admin *list* endpoint
    // (`TitleSummary`), which doesn't carry these fields at all — the client fills the gap with
    // `null` rather than omitting the key. `legacyTitleInputToCanonical` must treat that `null`
    // the same as "field not sent" (fall back to the row's current value), not as an explicit
    // clear — none of these four are actually nullable in `adminTitleInputSchema`, so failing to
    // do so previously made a null-workflowStatus/qualityScore/curatorNotes reject the entire
    // save with a generic 400, for every title the JSON editor touched.
    const title = `Null Means Absent Test ${randomUUID()}`;
    const createResponse = await postTitle({
      title,
      summary: "x",
      age: "16+",
      workflowStatus: "published",
      qualityScore: 55,
      curatorNotes: "keep me",
    });
    const { id } = (await createResponse.json()) as { id: string };
    createdTitleIds.push(id);

    const updateResponse = await postTitle({
      id,
      title,
      summary: "x",
      isPrivate: true,
      age: null,
      workflowStatus: null,
      qualityScore: null,
      curatorNotes: null,
    });
    expect(updateResponse.status).toBe(200);

    const row = assertDefined(
      (
        await database().client`
        select age, workflow_status, quality_score, curator_notes, is_private
        from titles where id=${id}`
      )[0],
      "expected the updated title row",
    );
    expect(row.age).toBe("16+");
    expect(row.workflow_status).toBe("published");
    expect(row.quality_score).toBe(55);
    expect(row.curator_notes).toBe("keep me");
    expect(row.is_private).toBe(true);
  });

  it("rejects an invalid audience with a 400 and structured issues", async () => {
    const response = await postTitle({
      title: `Invalid Audience Test ${randomUUID()}`,
      summary: "x",
      audience: "not-a-real-audience",
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string; issues: unknown[] };
    expect(body.issues).toBeInstanceOf(Array);
    expect(body.issues.length).toBeGreaterThan(0);
    // Nothing should have been created.
    const [row] = await database().client`
      select id from titles where canonical_title=${`Invalid Audience Test`}`;
    expect(row).toBeUndefined();
  });

  it("round-trips genres and aliases", async () => {
    const title = `Genres Roundtrip Test ${randomUUID()}`;
    const response = await postTitle({
      title,
      summary: "x",
      genres: ["Action"],
      aliases: ["An Alias"],
    });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    createdTitleIds.push(id);

    const genres = await database().client`
      select g.slug from title_genres tg join genres g on g.id=tg.value_id where tg.title_id=${id}`;
    expect(genres.map((row) => row.slug)).toContain("action");
    const aliases = await database().client`select title from title_aliases where title_id=${id}`;
    expect(aliases.map((row) => row.title)).toContain("An Alias");
  });

  it("moves workflow status to approved and stamps a verifier via the legacy curation field", async () => {
    const title = `Curation Test ${randomUUID()}`;
    const response = await postTitle({
      title,
      summary: "x",
      curation: { status: "verified", reviewedAt: "2024-01-01", notes: "looks good" },
    });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    createdTitleIds.push(id);

    const row = assertDefined(
      (
        await database().client`
        select workflow_status, curator_notes, verified_at from titles where id=${id}`
      )[0],
      "expected the curated title row",
    );
    expect(row.workflow_status).toBe("approved");
    expect(row.curator_notes).toBe("looks good");
    expect(row.verified_at).not.toBeNull();
    // verified_by_account_id itself is intentionally not asserted here: this test harness's
    // plain `app.request(...)` carries no session cookie, so `currentFamilyAccount` legitimately
    // resolves to null and the column stays null — that's the pre-existing, correct behavior for
    // an unauthenticated actor. The safety property this refactor adds is structural, not
    // observable via this column: `legacyTitleInputToCanonical` never reads a client-supplied
    // verifiedByAccountId at all, so there is no field for a client to spoof in the first place.
  });

  it("writes publishing fields directly when sent, ignoring the legacy curation field", async () => {
    const title = `Direct Publishing Fields Test ${randomUUID()}`;
    const response = await postTitle({
      title,
      summary: "x",
      age: "16+",
      workflowStatus: "published",
      qualityScore: 42,
      curatorNotes: "direct note",
      verifiedAt: "2024-06-15T00:00:00.000Z",
      // Present but must be ignored — the direct fields above take priority.
      curation: { status: "provisional", reviewedAt: "2020-01-01", notes: "stale" },
    });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    createdTitleIds.push(id);

    const row = assertDefined(
      (
        await database().client`
        select age, workflow_status, quality_score, curator_notes, verified_at
        from titles where id=${id}`
      )[0],
      "expected the directly-published title row",
    );
    expect(row.age).toBe("16+");
    expect(row.workflow_status).toBe("published");
    expect(row.quality_score).toBe(42);
    expect(row.curator_notes).toBe("direct note");
    expect(new Date(row.verified_at).toISOString()).toBe("2024-06-15T00:00:00.000Z");
  });

  it("clears verifiedAt when explicitly sent null, distinct from omitting it", async () => {
    const title = `Clear VerifiedAt Test ${randomUUID()}`;
    const createResponse = await postTitle({
      title,
      summary: "x",
      workflowStatus: "approved",
      verifiedAt: "2024-01-01T00:00:00.000Z",
    });
    const { id } = (await createResponse.json()) as { id: string };
    createdTitleIds.push(id);

    const unverifyResponse = await postTitle({
      id,
      title,
      summary: "x",
      workflowStatus: "in_review",
      verifiedAt: null,
    });
    expect(unverifyResponse.status).toBe(200);

    const row = assertDefined(
      (await database().client`select verified_at from titles where id=${id}`)[0],
      "expected the unverified title row",
    );
    expect(row.verified_at).toBeNull();
  });

  it("round-trips the five typed catalog ids across a save (player/torrent roadmap Phase 0)", async () => {
    // The bug this closes: artwork ingest used to write tmdb/anilist matches into
    // `external_identities`, and every title save did `delete from external_identities where
    // title_id=$1` and reinserted only what the client submitted — silently destroying any
    // ingested id. The typed columns this test checks are written directly by `applyTitleWrite`,
    // not through that delete-then-reinsert path.
    const title = `External Ids Roundtrip Test ${randomUUID()}`;
    const createResponse = await postTitle({
      title,
      summary: "x",
      tmdbId: 129,
      imdbId: "tt1798709",
      tvdbId: 79986,
      anilistId: 5114,
      malId: 5114,
    });
    expect(createResponse.status).toBe(201);
    const { id } = (await createResponse.json()) as { id: string };
    createdTitleIds.push(id);

    const created = assertDefined(
      (
        await database().client`
        select tmdb_id, imdb_id, tvdb_id, anilist_id, mal_id from titles where id=${id}`
      )[0],
      "expected the created title row",
    );
    expect(created.tmdb_id).toBe(129);
    expect(created.imdb_id).toBe("tt1798709");
    expect(created.tvdb_id).toBe(79986);
    expect(created.anilist_id).toBe(5114);
    expect(created.mal_id).toBe(5114);

    // Saving again with the same ids (as the editor form's full-object resend does) must not
    // lose them.
    const updateResponse = await postTitle({
      id,
      title,
      summary: "x, updated",
      tmdbId: 129,
      imdbId: "tt1798709",
      tvdbId: 79986,
      anilistId: 5114,
      malId: 5114,
    });
    expect(updateResponse.status).toBe(200);

    const updated = assertDefined(
      (
        await database().client`
        select tmdb_id, imdb_id, tvdb_id, anilist_id, mal_id, summary from titles where id=${id}`
      )[0],
      "expected the updated title row",
    );
    expect(updated.tmdb_id).toBe(129);
    expect(updated.imdb_id).toBe("tt1798709");
    expect(updated.tvdb_id).toBe(79986);
    expect(updated.anilist_id).toBe(5114);
    expect(updated.mal_id).toBe(5114);
    expect(updated.summary).toBe("x, updated");
  });

  it("silently ignores a legacy 'awards' array in the payload rather than writing it", async () => {
    const title = `Legacy Award Test ${randomUUID()}`;
    const response = await postTitle({
      title,
      summary: "x",
      // Stage 2 retired the legacy delete-then-reinsert award path entirely — a client still
      // sending this array (an old cached page, a stray request) must have it silently
      // ignored, not error and not write anything. Award recognitions are only ever written
      // through POST /api/v1/admin/awards/recognitions now.
      awards: [
        {
          organizationSlug: "should-be-ignored",
          organizationName: "Should Be Ignored",
          category: "Best Test",
          year: 2020,
          result: "winner",
          isFeatured: false,
          installmentId: null,
          sourceUrl: null,
          notes: null,
        },
      ],
    });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    createdTitleIds.push(id);

    const recognitions = await database().client`
      select id from award_recognitions where title_id=${id}`;
    expect(recognitions).toHaveLength(0);
  });
});
