/** Opt-in account verification against a freshly restored disposable database only. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(new URL("../../../packages/database/package.json", import.meta.url));
const postgres = require("postgres");
const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NAHHASIO_RUN_ACCOUNT_CHECK !== "1" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/nahhasio_accounts_[a-f0-9]+_test$/.test(url.pathname)
)
  throw new Error("A disposable account database and explicit opt-in are required");
const password = process.env.NAHHASIO_LOCAL_ACCOUNT_PASSWORD;
if (!password) throw new Error("Test credential must be provided privately");
const sql = postgres(url.toString(), { max: 1 });
const [{ role }] = await sql`select current_user as role`;
url.username = role;
const scratch = await mkdtemp(join(tmpdir(), "nahhasio-accounts-"));
const socket = createServer();
await new Promise((done) => socket.listen(0, "127.0.0.1", done));
const port = socket.address().port;
await new Promise((done) => socket.close(done));
const child = spawn(resolve("target/debug/nahhasio-server"), [], {
  env: {
    ...process.env,
    DATABASE_URL: url.toString(),
    NAHHASIO_BIND: `127.0.0.1:${port}`,
    NAHHASIO_LOCAL_ADMIN: "false",
    RUST_LOG: "warn",
  },
  stdio: ["ignore", "inherit", "inherit"],
});
const base = `http://127.0.0.1:${port}`;
const request = (path, token, body, method = body ? "POST" : "GET") => {
  const headers = new Headers();
  if (token) headers.set("Authorization", "Bearer " + token);
  if (body) headers.set("Content-Type", "application/json");
  if (body)
    return fetch(base + path, {
      method: method === "PATCH" ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(body),
    });
  return fetch(base + path, { method, headers });
};
const login = async (email, value = password) => {
  const response = await request("/api/v1/auth/login", null, { email, password: value });
  assert.equal(response.status, 200, "Expected valid test login");
  return response.json();
};
let checks = 0;
const status = async (response, expected) => {
  assert.equal(response.status, expected);
  checks++;
  return response;
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base + "/api/health/ready")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 50));
  }
  assert.equal(ready, true, "Disposable server database readiness failed");
  await status(await request("/api/v1/me"), 401);
  await status(await request("/api/v1/admin/access"), 401);
  const admin = await login("admin@nahhasio.local");
  const viewer = await login("user@nahhasio.local");
  assert.equal(admin.user.isAdmin, true);
  assert.equal(viewer.user.isAdmin, false);
  checks += 2;
  await status(await request("/api/v1/admin/access", admin.token), 200);
  await status(await request("/api/v1/admin/access", viewer.token), 403);
  await status(await request("/api/v1/catalog/browse", viewer.token), 200);
  await status(await request("/api/v1/catalog/browse?privacy=all", viewer.token), 403);
  await status(await request("/api/v1/works?includePrivate=true", viewer.token), 403);
  const avatars = [admin.user.avatarKey, viewer.user.avatarKey];
  for (const avatar of avatars) {
    const response = await status(
      await request(`/api/v1/auth/avatars/${avatar}`, viewer.token),
      200,
    );
    assert.match(await response.text(), /^<svg/);
    checks++;
  }
  await status(
    await request("/api/v1/me", viewer.token, { ...viewer.user, role: "owner" }, "PATCH"),
    422,
  );
  const profile = await (await request("/api/v1/me", viewer.token)).json();
  const update = {
    name: "حساب اختبار",
    bio: "نبذة محفوظة من قاعدة البيانات",
    avatarKey: "nahhasio-library.svg",
    updatedAt: profile.updatedAt,
  };
  const response = await status(await request("/api/v1/me", viewer.token, update, "PATCH"), 200);
  assert.equal((await response.json()).name, update.name);
  checks++;
  await status(await request("/api/v1/me", viewer.token, update, "PATCH"), 409);
  const second = await login("user@nahhasio.local");
  await status(
    await request("/api/v1/me/password", viewer.token, {
      currentPassword: "wrong",
      newPassword: "temporary-password",
    }),
    400,
  );
  await status(
    await request("/api/v1/me/password", viewer.token, {
      currentPassword: password,
      newPassword: "temporary-password",
    }),
    200,
  );
  await status(await request("/api/v1/auth/session", second.token), 401);
  await status(await request("/api/v1/auth/session", viewer.token), 200);
  const wrong = await request("/api/v1/auth/login", null, {
    email: "user@nahhasio.local",
    password,
  });
  await status(wrong, 401);
  const fresh = await login("user@nahhasio.local", "temporary-password");
  await status(await request("/api/v1/auth/logout", fresh.token, {}), 204);
  await status(await request("/api/v1/auth/session", fresh.token), 401);
  await sql`update accounts set status='suspended' where auth_user_id=${viewer.user.id}`;
  await status(await request("/api/v1/auth/session", viewer.token), 401);
  await sql`update auth_users set role='member' where id=${admin.user.id}`;
  await status(await request("/api/v1/admin/access", admin.token), 403);
  console.log(`${checks} real account API checks passed on disposable PostgreSQL.`);
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null) await new Promise((done) => child.once("exit", done));
  await sql.end();
  await rm(scratch, { recursive: true, force: true });
}
