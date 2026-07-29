import type { KeyboardEvent } from "react"
import { StarIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Work } from "../model"
import { useArabicTranslations } from "../translations"
import type { GalleryOptions } from "../view-types"
import { progressText, usesProgress, WorkArtwork } from "./work-artwork"

export type { GalleryOptions } from "../view-types"

function progressPercentage(work: Work) {
  if (!work.progressTotal) {
    return work.status === "completed" ? 100 : null
  }

  return Math.min(100, Math.round((work.progress / work.progressTotal) * 100))
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
  const { taxonomyLabel } = useArabicTranslations()
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
        const showFavorite = options.showFavorite && work.favorite
        const showCreator = options.showCreator && Boolean(work.creator)
        const showGenres = options.showGenres && work.genres.length > 0
        const showProgress = options.showProgress && usesProgress(work)
        const hasDetails =
          options.showTitle ||
          showFavorite ||
          showCreator ||
          options.showYear ||
          showGenres ||
          showProgress
        const workProgressText = showProgress ? progressText(work) : null

        return (
          <article
            key={work.id}
            role="button"
            tabIndex={0}
            aria-label={`فتح ${work.arabicTitle || work.title}`}
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

            {hasDetails && (
              <div className="px-1 pt-3">
                {(options.showTitle || showFavorite) && (
                  <div className="flex min-w-0 items-start gap-2">
                    {options.showTitle && (
                      <h2 className="line-clamp-2 flex-1 text-sm leading-snug font-semibold tracking-tight">
                        {work.arabicTitle || work.title}
                      </h2>
                    )}
                    {showFavorite && (
                      <span className="mt-0.5 shrink-0 text-amber-500">
                        <StarIcon
                          aria-hidden="true"
                          className="size-3.5"
                          weight="fill"
                        />
                        <span className="sr-only">في المفضلة</span>
                      </span>
                    )}
                  </div>
                )}

                {(showCreator || options.showYear) && (
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {showCreator && (
                      <span className="truncate">{work.creator}</span>
                    )}
                    {showCreator && options.showYear && (
                      <span aria-hidden="true">·</span>
                    )}
                    {options.showYear && (
                      <span className="shrink-0">
                        {work.year ?? "السنة غير معروفة"}
                      </span>
                    )}
                  </p>
                )}

                {showGenres && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {work.genres.slice(0, 2).map((genre) => (
                      <Badge
                        key={genre}
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] font-normal"
                      >
                        {taxonomyLabel("genre", genre)}
                      </Badge>
                    ))}
                  </div>
                )}

                {showProgress && workProgressText && (
                  <Progress
                    value={progressPercentage(work)}
                    aria-valuetext={workProgressText}
                    className="mt-2.5 gap-1.5"
                  >
                    <ProgressLabel className="text-[11px] font-normal text-muted-foreground">
                      التقدم
                    </ProgressLabel>
                    <ProgressValue className="max-w-[75%] truncate text-[11px]">
                      {() => workProgressText}
                    </ProgressValue>
                  </Progress>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
