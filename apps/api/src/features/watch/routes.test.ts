import { describe, expect, it } from "vitest";
import { app } from "../../app";

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

describe("/api/v1/watch/streams", () => {
  it("is closed to family profiles, since no classification can apply to a bare id", async () => {
    const token = await signIn("personal", "ArcadiaPersonal!2026");
    const response = await app.request("/api/v1/watch/streams?imdbId=tt0133093", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
  });

  it("rejects a malformed id before touching the addon", async () => {
    const token = await signIn("admin", "ArcadiaAdmin!2026");
    const response = await app.request("/api/v1/watch/streams?imdbId=matrix", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(400);
  });

  it("answers an owner with sources, a source failure, or 'not configured' — never a crash", async () => {
    const token = await signIn("admin", "ArcadiaAdmin!2026");
    const response = await app.request("/api/v1/watch/streams?imdbId=tt0133093", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect([200, 502, 503]).toContain(response.status);
    if (response.status === 200) {
      const body = await response.json();
      expect(body.streamId).toBe("tt0133093");
      expect(Array.isArray(body.candidates)).toBe(true);
    }
  });
});
