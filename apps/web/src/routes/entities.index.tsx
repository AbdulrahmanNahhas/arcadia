import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { EntitiesPage } from "@/features/entities/entities-page";
import { contributorRoleSchema } from "@/features/library/model";

const entitySearchSchema = z.object({
  q: z.string().optional(),
  type: z.enum(["all", "person", "organization"]).optional(),
  role: z.union([z.literal("all"), contributorRoleSchema]).optional(),
  sort: z.enum(["name", "works"]).optional(),
});

export const Route = createFileRoute("/entities/")({
  validateSearch: entitySearchSchema,
  component: EntitiesRoute,
});

function EntitiesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <EntitiesPage
      search={search}
      onSearchChange={(next) => navigate({ search: next, replace: true })}
    />
  );
}
