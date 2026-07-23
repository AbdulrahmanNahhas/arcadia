import { StarIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { kindLabels } from "../filtering"
import type { Work } from "../model"

export function Timeline({
  works,
  onOpen,
  newestFirst,
}: {
  works: Work[]
  onOpen: (id: string) => void
  newestFirst: boolean
}) {
  const groups = works.reduce<Map<number, Work[]>>((map, work) => {
    const year = work.year ?? 0
    map.set(year, [...(map.get(year) ?? []), work])
    return map
  }, new Map())

  return (
    <div className="timeline mx-auto max-w-6xl">
      {[...groups.entries()]
        .sort(([a], [b]) => (newestFirst ? b - a : a - b))
        .map(([year, items]) => (
          <section key={year} className="grid md:grid-cols-[110px_1fr]">
            <header className="pb-4 md:pr-5 md:text-right">
              <h2 className="text-xl font-semibold tracking-tight">
                {year || "TBD"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "work" : "works"}
              </p>
            </header>
            <div className="relative grid gap-2 border-l pb-8! pl-5 before:absolute before:top-2 before:-left-1.25 before:size-2.5 before:rounded-full before:border-2 before:border-background before:bg-primary last:pb-0 lg:grid-cols-2">
              {items.map((work) => (
                <button
                  type="button"
                  key={work.id}
                  onClick={() => onOpen(work.id)}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border bg-card p-2.5 text-left shadow-xs transition hover:border-primary/30 hover:bg-accent/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {work.imagePath ? (
                      <img
                        className="size-full object-cover"
                        src={work.imagePath}
                        alt=""
                      />
                    ) : (
                      <div className="size-full bg-linear-to-br from-primary/15 to-primary/45" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {work.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {kindLabels[work.kind]} ·{" "}
                      {work.creator || "Unknown creator"}
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      {work.genres.slice(0, 2).map((genre) => (
                        <Badge
                          key={genre}
                          variant="secondary"
                          className="py-0 text-[10px] font-normal"
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {work.rating !== null && (
                      <span className="mb-1 flex items-center justify-end gap-1 text-xs font-medium">
                        <StarIcon
                          className="size-3 text-amber-500"
                          weight="fill"
                        />
                        {work.rating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {work.status.replace("-", " ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
