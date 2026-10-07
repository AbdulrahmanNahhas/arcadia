import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireLocalAdmin } from "./database.server";

export const exportWork = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const [{ openDatabase }, { workExport }] = await Promise.all([
      import("@arcadia/cli/db"),
      import("@arcadia/cli/work"),
    ]);
    return workExport(openDatabase(), data.id);
  });
export const applyWork = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      json: z.string().max(4000000),
      dryRun: z.boolean().default(true),
      createOnly: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const [{ openDatabase }, { workApply, workDocument }] = await Promise.all([
      import("@arcadia/cli/db"),
      import("@arcadia/cli/work"),
    ]);
    workDocument.parse(JSON.parse(data.json));
    const flags = new Map<string, string | boolean>([
      ["json", data.json],
      ["mode", "merge"],
      ["dry-run", data.dryRun],
      ["create-only", data.createOnly],
    ]);
    return workApply(openDatabase(), { positionals: [], flags, repeated: new Map() }, undefined);
  });
