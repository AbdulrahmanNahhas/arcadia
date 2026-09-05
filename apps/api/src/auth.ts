import { account, session, user, verification } from "@arcadia/database";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { bearer, username } from "better-auth/plugins";
import { database } from "./database";

const developmentSecret = "arcadia-development-secret-change-before-production-2026";

function authSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }
  return developmentSecret;
}

export const auth = betterAuth({
  appName: "Arcadia",
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:23101",
  secret: authSecret(),
  trustedOrigins: [
    process.env.ARCADIA_WEB_URL ?? "http://127.0.0.1:23100",
    "http://localhost:23100",
    // See the matching comment in app.ts's CORS trustedOrigins — a packaged Tauri app always
    // serves from this fixed origin, independent of any env var.
    "http://tauri.localhost",
  ],
  database: drizzleAdapter(database().db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
        input: false,
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
    }),
    // The desktop app cannot authenticate with cookies at all. Its page origin is
    // `http://tauri.localhost` (packaged) or `http://127.0.0.1:23100` (tauri dev), while the API
    // answers on the server's LAN address — different sites, so the browser accepts the session
    // cookie and then refuses to send it back on every subsequent request. `SameSite=None` would
    // fix that but requires `Secure`, and a family server on a LAN speaks plain HTTP with no
    // certificate to offer. A bearer token carries the session in a header instead, where no
    // same-site rule applies. Cookies still work unchanged for same-origin browser use.
    bearer(),
  ],
  advanced: {
    cookiePrefix: "arcadia",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type AuthSession = typeof auth.$Infer.Session;

export function getAuthSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

export function isTestAuthBypass() {
  return process.env.NODE_ENV === "test" && process.env.ARCADIA_MOCK_AUTH === "true";
}
