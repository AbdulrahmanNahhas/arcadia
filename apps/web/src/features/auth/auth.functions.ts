import { createServerFn } from "@tanstack/react-start";

import { loginSchema } from "./auth-model";
import { ownerLogin, ownerLogout, ownerSession } from "./auth.server";

export const getOwnerSession = createServerFn({ method: "GET" }).handler(() => ownerSession());
export const loginOwner = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(({ data }) => ownerLogin(data));
export const logoutOwner = createServerFn({ method: "POST" }).handler(() => ownerLogout());
