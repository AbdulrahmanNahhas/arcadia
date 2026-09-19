import { backgroundJobSchema } from "@arcadia/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { app } from "../../app";

const jobOutcomeSchema = z.object({
  id: z.string().uuid(),
  result: z.record(z.string(), z.number()),
});
const healthSchema = z.object({
  database: z.object({ bytes: z.number() }),
  integrations: z.object({ tmdb: z.boolean() }),
});

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

// Jobs record who ran them (a real account row), so the admin gate's test bypass is not enough.
const adminHeaders = async () => ({
  "content-type": "application/json",
  authorization: `Bearer ${await signIn("admin", "ArcadiaAdmin!2026")}`,
});

describe("/api/v1/admin/maintenance", () => {
  it("runs the validate job and records a counted result", async () => {
    const response = await app.request("/api/v1/admin/maintenance/jobs", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ type: "validate" }),
    });
    expect(response.status).toBe(201);
    const body = jobOutcomeSchema.parse(await response.json());
    const result = body.result;
    expect(result.total ?? -1).toBeGreaterThanOrEqual(0);
    expect((result.errors ?? 0) + (result.warnings ?? 0) + (result.info ?? 0)).toBe(result.total);

    // The jobs list needs a session too (it 401s into a message object otherwise).
    const jobs = await app.request("/api/v1/admin/archive/jobs", { headers: await adminHeaders() });
    const list = z.array(backgroundJobSchema).parse(await jobs.json());
    expect(list.some((job) => job.id === body.id && job.status === "completed")).toBe(true);
  });

  it("inspects media and reports counts", async () => {
    const response = await app.request("/api/v1/admin/maintenance/jobs", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ type: "inspect-media" }),
    });
    expect(response.status).toBe(201);
    const body = jobOutcomeSchema.parse(await response.json());
    expect(body.result.assets ?? 0).toBeGreaterThanOrEqual(body.result.missing ?? 0);
  });

  it("refuses an unknown job type and a non-repairable issue", async () => {
    const job = await app.request("/api/v1/admin/maintenance/jobs", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ type: "drop-everything" }),
    });
    expect(job.status).toBe(400);
    const repair = await app.request("/api/v1/admin/maintenance/repair", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ issueId: "metadata:00000000-0000-0000-0000-000000000000" }),
    });
    expect(repair.status).toBe(400);
  });

  it("reports server health", async () => {
    const response = await app.request("/api/v1/admin/health");
    expect(response.status).toBe(200);
    const body = healthSchema.parse(await response.json());
    expect(body.database.bytes).toBeGreaterThan(0);
  });
});
