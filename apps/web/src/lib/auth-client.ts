import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { apiBaseUrl } from "./api";

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  basePath: "/api/auth",
  fetchOptions: { credentials: "include" },
  plugins: [usernameClient()],
});
