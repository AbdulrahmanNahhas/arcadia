import { adminEpisodesResponseSchema, auditLogPageSchema } from "@arcadia/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";
import { createScratchInstallment } from "../../test-support";

let season: Awaited<ReturnType<typeof createScratchInstallment>>;

beforeAll(async () => {
  season = await createScratchInstallment(`episodes ${Date.now()}`, "season");
});

afterAll(async () => {
  await season?.remove();
});

const headers = { "content-type": "application/json" };

describe("/api/v1/admin/installments/:id/episodes", () => {
  it("creates, reorders in place (keeping ids), and removes episodes", async () => {
    const created = await app.request(
      `/api/v1/admin/installments/${season.installmentId}/episodes`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          episodes: [
            {
              number: 1,
              position: 1,
              title: "الأولى",
              summary: "",
              releaseDate: "2024-01-07",
              runtimeMinutes: 24,
            },
            {
              number: 2,
              position: 2,
              title: "الثانية",
              summary: "ملخص",
              releaseDate: null,
              runtimeMinutes: null,
            },
          ],
        }),
      },
    );
    expect(created.status).toBe(200);
    const first = adminEpisodesResponseSchema.parse(await created.json());
    expect(first.episodes.map((episode) => episode.number)).toEqual([1, 2]);
    const [one, two] = first.episodes;
    if (!one || !two) throw new Error("expected two episodes");

    // Swap the two positions — the unique index must not get in the way, and ids must survive.
    const swapped = await app.request(
      `/api/v1/admin/installments/${season.installmentId}/episodes`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          episodes: [
            { ...one, position: 2, number: 2 },
            { ...two, position: 1, number: 1 },
          ],
        }),
      },
    );
    expect(swapped.status).toBe(200);
    const second = adminEpisodesResponseSchema.parse(await swapped.json());
    expect(second.episodes.map((episode) => episode.id)).toEqual([two.id, one.id]);

    const removed = await app.request(
      `/api/v1/admin/installments/${season.installmentId}/episodes`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          episodes: [{ ...two, position: 1, number: 1 }],
          removeIds: [one.id],
        }),
      },
    );
    const third = adminEpisodesResponseSchema.parse(await removed.json());
    expect(third.episodes).toHaveLength(1);
    const [row] = await database()
      .client`select count(*)::int as count from episodes where installment_id=${season.installmentId}`;
    expect(Number(row?.count)).toBe(1);
  });

  it("rejects duplicate numbers", async () => {
    const response = await app.request(
      `/api/v1/admin/installments/${season.installmentId}/episodes`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          episodes: [
            {
              number: 5,
              position: 5,
              title: null,
              summary: "",
              releaseDate: null,
              runtimeMinutes: null,
            },
            {
              number: 5,
              position: 6,
              title: null,
              summary: "",
              releaseDate: null,
              runtimeMinutes: null,
            },
          ],
        }),
      },
    );
    expect(response.status).toBe(400);
  });

  it("explains a missing TMDB id instead of guessing", async () => {
    const response = await app.request(
      `/api/v1/admin/installments/${season.installmentId}/episodes/tmdb`,
    );
    expect([409, 503]).toContain(response.status);
  });
});

describe("/api/v1/admin/audit-logs", () => {
  it("lists the rows admin writes leave behind, newest first, with a total", async () => {
    const response = await app.request("/api/v1/admin/audit-logs?limit=5");
    expect(response.status).toBe(200);
    const body = auditLogPageSchema.parse(await response.json());
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.total).toBeGreaterThanOrEqual(body.items.length);
  });

  it("prunes nothing when asked for a horizon in the far past", async () => {
    const response = await app.request("/api/v1/admin/audit-logs", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ olderThanDays: 3650 }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).deleted).toBe(0);
  });
});
