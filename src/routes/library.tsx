import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { decodeViewState, encodeViewState } from "@/features/library/library-state";
import { LibraryViewPage } from "@/features/library/library-view";

const librarySearchSchema = z.object({
  view: z.string().optional(),
  work: z.string().optional(),
  config: z.string().optional(),
});

export const Route = createFileRoute("/library")({
  validateSearch: librarySearchSchema,
  component: LibraryRoute,
});

function LibraryRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const viewState = decodeViewState(search.config);

  return (
    <LibraryViewPage
      viewId={search.view}
      workId={search.work}
      initialState={viewState}
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
        navigate({
          search: (previous) => ({ ...previous, work }),
          replace: !work,
        })
      }
    />
  );
}
