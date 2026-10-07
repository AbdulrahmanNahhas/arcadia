import { queryOptions } from "@tanstack/react-query";
import * as z from "zod/mini";

const readinessSchema = z.object({ status: z.enum(["ready", "unavailable"]) });
const serverKeys = { readiness: ["server", "readiness"] as const };

async function fetchReadiness(signal: AbortSignal) {
  const response = await fetch("/api/health/ready", { signal, credentials: "same-origin" });
  const health = readinessSchema.parse(await response.json());
  if (!response.ok || health.status !== "ready") throw new Error("الخادم غير متاح الآن");
  return health;
}

export function readinessOptions() {
  return queryOptions({
    queryKey: serverKeys.readiness,
    queryFn: ({ signal }) => fetchReadiness(signal),
  });
}
