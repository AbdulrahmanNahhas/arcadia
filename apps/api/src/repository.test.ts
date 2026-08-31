import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "./database";
import { browse, titleReleaseStatusFromInstallments } from "./repository";

describe("titleReleaseStatusFromInstallments", () => {
  it.each([
    [["announced"], "upcoming"],
    [["airing"], "airing"],
    [["completed", "announced"], "returning"],
    [["completed"], "completed"],
    [["unknown", "completed"], "unknown"],
    [[], "unknown"],
  ] as const)("calculates %j as %s", (installments, expected) => {
    expect(titleReleaseStatusFromInstallments(installments)).toBe(expected);
  });
});

describe("installment isPlayable", () => {
  const titleIds: string[] = [];

  afterAll(async () => {
    const sql = database().client;
    if (titleIds.length) await sql`delete from titles where id in ${sql(titleIds)}`;
    await sql.end();
  });

  it("is false for an announced, future-dated movie even though it has its own IMDb id", async () => {
    // The Ray Gunn bug: a movie can be fully catalogued (its own id, for whenever it releases)
    // and still not be playable *yet* — id-resolvability and release status are independent
    // gates, and `isPlayable` has to require both.
    const sql = database().client;
    const name = `Repository Test ${randomUUID().slice(0, 8)}`;
    const [title] = await sql`
      insert into titles (canonical_title, sort_title) values (${name}, ${name}) returning id`;
    const titleId = String(title?.id);
    titleIds.push(titleId);
    await sql`
      insert into installments (title_id, kind, position, title, status, release_date, imdb_id)
      values (${titleId}, 'movie', 0, ${name}, 'announced', '2099-01-01', 'tt1234567')`;

    const result = await browse({
      q: name,
      mode: "installments",
      sort: "title",
      limit: 10,
      offset: 0,
    });
    const found = result.items.find((item) => "titleId" in item && item.titleId === titleId);
    expect(found && "isPlayable" in found ? found.isPlayable : undefined).toBe(false);
  });

  it("is true once that same movie is marked completed", async () => {
    const sql = database().client;
    const name = `Repository Test ${randomUUID().slice(0, 8)}`;
    const [title] = await sql`
      insert into titles (canonical_title, sort_title) values (${name}, ${name}) returning id`;
    const titleId = String(title?.id);
    titleIds.push(titleId);
    await sql`
      insert into installments (title_id, kind, position, title, status, release_date, imdb_id)
      values (${titleId}, 'movie', 0, ${name}, 'completed', '2020-01-01', 'tt1234568')`;

    const result = await browse({
      q: name,
      mode: "installments",
      sort: "title",
      limit: 10,
      offset: 0,
    });
    const found = result.items.find((item) => "titleId" in item && item.titleId === titleId);
    expect(found && "isPlayable" in found ? found.isPlayable : undefined).toBe(true);
  });
});
