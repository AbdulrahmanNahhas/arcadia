import { account, session, user, verification } from "@arcadia/database";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
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
