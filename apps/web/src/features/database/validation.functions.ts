import { createServerFn } from "@tanstack/react-start";

import { requireLocalAdmin } from "./database.server";
export const validateCatalog = createServerFn({ method: "GET" }).handler(async () => {
  requireLocalAdmin();
  const { collectValidationIssues } = await import("@arcadia/api/validation");
  return collectValidationIssues();
});
