import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ComparePage } from "@/features/library/compare-page";

const compareSearchSchema = z.object({
  ids: z.string().optional(),
});

export const Route = createFileRoute("/compare")({
  validateSearch: compareSearchSchema,
  component: CompareRoute,
});

function CompareRoute() {
  const { ids } = Route.useSearch();
  const navigate = Route.useNavigate();
  const comparisonIds = [...new Set(ids?.split(",").filter(Boolean) ?? [])];
  return (
    <ComparePage
      ids={comparisonIds}
      onIdsChange={(nextIds) =>
        navigate({
          search: { ids: nextIds.length ? nextIds.join(",") : undefined },
          replace: true,
        })
      }
    />
  );
}
