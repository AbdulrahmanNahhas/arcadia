import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { LibraryViewPage } from "@/features/library/library-view"

const librarySearchSchema = z.object({
  view: z.string().optional(),
  work: z.string().optional(),
})

export const Route = createFileRoute("/library")({
  validateSearch: librarySearchSchema,
  component: LibraryRoute,
})

function LibraryRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <LibraryViewPage
      viewId={search.view}
      workId={search.work}
      onViewChange={(view) =>
        navigate({
          search: (previous) => ({ ...previous, view, work: undefined }),
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
  )
}
