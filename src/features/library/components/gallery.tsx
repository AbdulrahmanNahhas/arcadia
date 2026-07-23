import type { KeyboardEvent } from "react"
import { StarIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { kindLabels } from "../filtering"
import type { Work } from "../model"
import { WorkArtwork } from "./work-artwork"

export type GalleryOptions = {
  mode: "cover" | "title" | "full"
  imageType: "poster" | "logo"
  showType: boolean
  showRating: boolean
}

export function Gallery({
  works,
  selectedId,
  onSelect,
  onOpen,
  cardSize,
  options,
}: {
  works: Work[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  cardSize: number
  options: GalleryOptions
}) {
  const openFromKeyboard = (event: KeyboardEvent, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen(id)
    }
  }

  return (
    <div
      className="grid items-start gap-x-4 gap-y-7"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${cardSize}px), 1fr))`,
      }}
    >
      {works.map((work) => {
        const selected = selectedId === work.id
        return (
          <article
            key={work.id}
            role="button"
            tabIndex={0}
            aria-label={`Open ${work.title}`}
            aria-current={selected ? "true" : undefined}
            onMouseEnter={() => onSelect(work.id)}
            onFocus={() => onSelect(work.id)}
            onClick={() => onOpen(work.id)}
            onKeyDown={(event) => openFromKeyboard(event, work.id)}
            className={cn(
              "group min-w-0 cursor-pointer rounded-2xl transition duration-200 outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
              selected && "-translate-y-0.5"
            )}
          >
            <div
              className={cn(
                "rounded-xl shadow-sm ring-1 ring-black/5 transition duration-200 dark:ring-white/10",
                "group-hover:shadow-lg group-hover:shadow-black/10",
                selected && "shadow-lg ring-2 ring-primary/70"
              )}
            >
              <WorkArtwork
                work={work}
                image={options.imageType}
                showType={options.showType}
                showRating={options.showRating}
              />
            </div>

            {options.mode !== "cover" && (
              <div className="px-1 pt-3">
                <div className="flex min-w-0 items-start gap-2">
                  <h2 className="line-clamp-2 flex-1 text-sm leading-snug font-semibold tracking-tight">
                    {work.title}
                  </h2>
                  {work.favorite && (
                    <StarIcon
                      className="mt-0.5 size-3.5 shrink-0 text-amber-500"
                      weight="fill"
                    />
                  )}
                </div>
                {options.mode === "full" && (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {work.year ?? "Year unknown"} · {kindLabels[work.kind]}
                    </p>
                    {work.genres.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {work.genres.slice(0, 2).map((genre) => (
                          <Badge
                            key={genre}
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px] font-normal"
                          >
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
