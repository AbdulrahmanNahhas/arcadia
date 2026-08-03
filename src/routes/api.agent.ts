import { createFileRoute } from "@tanstack/react-router";

function values(params: URLSearchParams, name: string) {
  return params
    .getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function optionalInteger(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function optionalBoolean(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function tableFilters(params: URLSearchParams) {
  return params.getAll("where").map((filter) => {
    const separator = filter.indexOf("=");
    if (separator < 1) throw new Error("where must use column=value");
    const value = filter.slice(separator + 1);
    return {
      column: filter.slice(0, separator),
      value: value === "null" ? null : value,
    };
  });
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const access = await import("@/db/agent-access");
          const params = new URL(request.url).searchParams;
          const resource = params.get("resource") ?? "help";

          if (resource === "help") {
            return Response.json({
              resources: ["works", "work", "tables", "schema", "table"],
              readOnly: true,
            });
          }
          if (resource === "works") {
            return Response.json(
              access.queryWorks({
                search: params.get("search") ?? undefined,
                kinds: values(params, "kind"),
                statuses: values(params, "status"),
                releaseStatuses: values(params, "release-status"),
                genres: values(params, "genre"),
                tags: values(params, "tag"),
                tones: values(params, "tone"),
                contributors: values(params, "contributor"),
                countries: values(params, "country"),
                audiences: values(params, "audience"),
                providers: values(params, "provider"),
                favorite: optionalBoolean(params, "favorite"),
                yearFrom: optionalInteger(params, "year-from"),
                yearTo: optionalInteger(params, "year-to"),
                limit: optionalInteger(params, "limit"),
                offset: optionalInteger(params, "offset"),
              }),
            );
          }
          if (resource === "work") {
            const id = params.get("id");
            if (!id) throw new Error("id is required");
            return Response.json(
              access.getAgentWorkDetails(id, optionalInteger(params, "tracking-limit")),
            );
          }
          if (resource === "tables") return Response.json(access.listDatabaseTables());
          if (resource === "schema") {
            return Response.json(access.getDatabaseSchema(params.get("table") ?? undefined));
          }
          if (resource === "table") {
            const table = params.get("table");
            if (!table) throw new Error("table is required");
            return Response.json(
              access.listTableRows(table, {
                where: tableFilters(params),
                order: params.get("order") ?? undefined,
                descending: optionalBoolean(params, "descending"),
                limit: optionalInteger(params, "limit"),
                offset: optionalInteger(params, "offset"),
              }),
            );
          }
          return Response.json({ error: `Unknown resource: ${resource}` }, { status: 404 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          const status = message.startsWith("Work not found") ? 404 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
