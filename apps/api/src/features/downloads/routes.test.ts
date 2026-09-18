import { accountDownloadSchema } from "@arcadia/contracts";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { app } from "../../app";
import { database } from "../../database";

async function signIn(username: string, password: string) {
  const response = await app.request("/api/auth/sign-in/username", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const token = response.headers.get("set-auth-token");
  if (!token) throw new Error("Expected Better Auth to return a bearer token");
  return token;
}

const deviceId = `test-device-${Date.now()}`;

afterAll(async () => {
  await database().client`delete from account_downloads where device_id=${deviceId}`;
});

describe("/api/v1/me/downloads", () => {
  it("upserts one row per device and unit, lists it, and deletes it", async () => {
    const token = await signIn("personal", "ArcadiaPersonal!2026");
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const [installment] = await database().client`
      select id from installments where kind='movie' limit 1`;
    if (!installment) throw new Error("seeded catalog has no movie installment");
    const body = {
      installmentId: String(installment.id),
      episodeId: null,
      deviceId,
      deviceName: "جهاز الاختبار",
      path: "/home/family/Videos/Arcadia/Test/film.mkv",
      sizeBytes: 1_500_000_000,
      state: "downloading",
    };

    const first = await app.request("/api/v1/me/downloads", {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    expect(first.status).toBe(200);
    const created = accountDownloadSchema.parse(await first.json());
    expect(created.state).toBe("downloading");

    const second = await app.request("/api/v1/me/downloads", {
      method: "PUT",
      headers,
      body: JSON.stringify({ ...body, state: "completed" }),
    });
    const updated = accountDownloadSchema.parse(await second.json());
    expect(updated.id).toBe(created.id);
    expect(updated.state).toBe("completed");

    const list = await app.request("/api/v1/me/downloads", { headers });
    const rows = z.array(accountDownloadSchema).parse(await list.json());
    expect(rows.filter((row) => row.deviceId === deviceId)).toHaveLength(1);

    const removed = await app.request(`/api/v1/me/downloads/${created.id}`, {
      method: "DELETE",
      headers,
    });
    expect(removed.status).toBe(204);
    const after = await app.request("/api/v1/me/downloads", { headers });
    const remaining = z.array(accountDownloadSchema).parse(await after.json());
    expect(remaining.some((row) => row.id === created.id)).toBe(false);
  });

  it("rejects an unauthenticated write", async () => {
    const response = await app.request("/api/v1/me/downloads", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(401);
  });
});
