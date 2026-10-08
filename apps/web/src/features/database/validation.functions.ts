import { validationIssueSchema } from "@arcadia/contracts";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireLocalAdmin } from "./database.server";
export const validateCatalog = createServerFn({ method: "GET" }).handler(async () => {
  requireLocalAdmin();
  const { collectValidationIssues } = await import("@arcadia/api/validation");
  return z.array(validationIssueSchema).parse(await collectValidationIssues());
});
