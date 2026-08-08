import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { decodeViewState, encodeViewState } from "@/features/library/library-state";
import { LibraryViewPage } from "@/features/library/library-view";

const databaseSearchSchema = z.object({
  view: z.string().optional(),
  work: z.string().optional(),
  config: z.string().optional(),
});

export const Route = createFileRoute("/database")({
  validateSearch: databaseSearchSchema,
  component: DatabaseRoute,
});

function DatabaseRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LibraryViewPage
      viewId={search.view}
      workId={search.work}
      initialState={decodeViewState(search.config)}
      onStateChange={(state) =>
        navigate({
          search: (previous) => ({ ...previous, config: encodeViewState(state) }),
          replace: true,
        })
      }
      onViewChange={(view) =>
        navigate({
          search: (previous) => ({ ...previous, view, work: undefined, config: undefined }),
          replace: true,
        })
      }
      onWorkChange={(work) =>
        navigate({ search: (previous) => ({ ...previous, work }), replace: !work })
      }
    />
  );
}
