import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { CollectionView } from "@/features/library/collection-view"
import { isCollectionId } from "@/features/library/collections"

const librarySearchSchema = z.object({
  view: z.enum(["all", "progress", "favorites"]).catch("all"),
  saved: z.string().optional(),
  work: z.string().optional(),
})

export const Route = createFileRoute("/library/$collection")({
  validateSearch: librarySearchSchema,
  beforeLoad: ({ params }) => {
    if (!isCollectionId(params.collection)) throw notFound()
  },
  component: CollectionRoute,
})

function CollectionRoute() {
  const { collection } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  if (!isCollectionId(collection)) return null

  return (
    <CollectionView
      collectionId={collection}
      view={search.view}
      workId={search.work}
      savedViewId={search.saved}
      onCollectionChange={(nextCollection) =>
        navigate({
          to: "/library/$collection",
          params: { collection: nextCollection },
          search: { view: "all" },
        })
      }
      onViewChange={(view) =>
        navigate({
          search: (previous) => ({ ...previous, view }),
          replace: true,
        })
      }
      onWorkChange={(work) =>
        navigate({
          search: (previous) => ({ ...previous, work }),
          replace: !work,
        })
      }
      onSavedViewChange={(saved) =>
        navigate({
          search: (previous) => ({ ...previous, saved }),
          replace: true,
        })
      }
    />
  )
}
