import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";

/**
 * The structure route saves in place: a resave keeps installment and episode ids, so everything
 * that cascades on them — the family's playback states above all — survives. The old
 * delete-and-reinsert wiped `account_playback_states` every time a poster or an id was set.
 */
describe("PUT /api/v1/admin/titles/:titleId/structure — identity survival", () => {
  const createdTitleIds: string[] = [];

  afterAll(async () => {
    const sql = database().client;
    if (createdTitleIds.length) await sql`delete from titles where id in ${sql(createdTitleIds)}`;
  });

  it("keeps installment/episode ids and playback states across a resave and a reorder", async () => {
    const sql = database().client;
    const name = `Structure Identity ${randomUUID()}`;
    const [title] = await sql`insert into titles (canonical_title, sort_title, title_ar, summary)
      values (${name}, ${name.toLowerCase()}, ${name}, 'x') returning id`;
    const titleId = String(title?.id);
    createdTitleIds.push(titleId);
    const [season] = await sql`insert into installments (title_id, kind, position, title, status)
      values (${titleId}, 'season', 1, 'S1', 'completed') returning id`;
    const installmentId = String(season?.id);
    const [episodeOne] = await sql`insert into episodes (installment_id, number, position, title)
      values (${installmentId}, 1, 1, 'E1') returning id`;
    const [episodeTwo] = await sql`insert into episodes (installment_id, number, position, title)
      values (${installmentId}, 2, 2, 'E2') returning id`;
    const [account] = await sql`select id from accounts order by created_at limit 1`;
    if (!account) throw new Error("seeded accounts required");
    await sql`insert into account_playback_states
      (account_id, installment_id, episode_id, position_seconds, duration_seconds)
      values (${account.id}, ${installmentId}, ${episodeOne?.id}, 300, 1400)`;

    const body = {
      seasons: [
        {
          id: installmentId,
          title: "S1 renamed",
          installmentKind: "season",
          position: 1,
          releaseStatus: "completed",
          posterPath: null,
          units: [
            // Swapped order: E2 first — the two-pass reorder must not trip the unique indexes.
            { id: String(episodeTwo?.id), unitNumber: 2, position: 1, title: "E2" },
            { id: String(episodeOne?.id), unitNumber: 1, position: 2, title: "E1 renamed" },
            { unitNumber: 3, position: 3, title: "E3 new" },
          ],
        },
      ],
      ungroupedUnits: [],
    };
    const response = await app.request(`/api/v1/admin/titles/${titleId}/structure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);

    const installments = await sql`select id, title from installments where title_id=${titleId}`;
    expect(installments.map((row) => String(row.id))).toEqual([installmentId]);
    expect(installments[0]?.title).toBe("S1 renamed");
    const episodes = await sql`select id, title, position from episodes
      where installment_id=${installmentId} order by position`;
    expect(episodes.map((row) => String(row.id))).toEqual([
      String(episodeTwo?.id),
      String(episodeOne?.id),
      String(episodes[2]?.id),
    ]);
    expect(episodes.length).toBe(3);
    const [playback] = await sql`select position_seconds from account_playback_states
      where installment_id=${installmentId} and episode_id=${episodeOne?.id}`;
    expect(Number(playback?.position_seconds)).toBe(300);

    // Dropping an episode from the document is the one explicit deletion.
    const trimmed = {
      ...body,
      seasons: [{ ...body.seasons[0], units: body.seasons[0]?.units.slice(0, 1) ?? [] }],
    };
    await app.request(`/api/v1/admin/titles/${titleId}/structure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trimmed),
    });
    const remaining = await sql`select id from episodes where installment_id=${installmentId}`;
    expect(remaining.map((row) => String(row.id))).toEqual([String(episodeTwo?.id)]);
    await sql`delete from account_playback_states where installment_id=${installmentId}`;
  });
});
