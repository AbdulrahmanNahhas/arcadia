import type { KeyboardEvent } from "react"
import { HeartIcon, ImageIcon, StarIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { kindLabels } from "../filtering"
import type { Work } from "../model"
import { statusLabelsAr, useArabicTranslations } from "../translations"
import { tableColumnIds } from "../view-types"
import type { TableColumnId, TableDensity } from "../view-types"
import { progressText, usesProgress } from "./work-artwork"

export const tableColumnLabels: Record<TableColumnId, string> = {
  artwork: "الغلاف",
  title: "العنوان",
  creator: "صنّاع العمل",
  favorite: "المفضلة",
  type: "النوع",
  year: "السنة",
  releaseStatus: "حالة الإصدار",
  status: "حالة المتابعة",
  genres: "التصنيفات",
  progress: "التقدم",
  rating: "التقييم",
  studios: "الاستوديوهات",
  country: "البلد",
  audience: "الجمهور",
  addedAt: "تاريخ الإضافة",
  trackedOn: "تاريخ التتبع",
}

type WorkTableProps = {
  works: Work[]
  selectedId: string | null
  onOpen: (id: string) => void
  columns: TableColumnId[]
  density: TableDensity
}

type DensityClasses = {
  header: string
  cell: string
  artwork: string
  secondaryText: string
}

const densityClasses: Record<TableDensity, DensityClasses> = {
  compact: {
    header: "h-9",
    cell: "px-2.5 py-1.5",
    artwork: "w-8 rounded-md",
    secondaryText: "text-[11px]",
  },
  comfortable: {
    header: "h-10",
    cell: "px-3 py-2.5",
    artwork: "w-10 rounded-md",
    secondaryText: "text-xs",
  },
  spacious: {
    header: "h-12",
    cell: "px-3.5 py-3.5",
    artwork: "w-12 rounded-lg",
    secondaryText: "text-xs",
  },
}

const columnClasses: Record<TableColumnId, string> = {
  artwork: "w-20 min-w-20 max-w-20",
  title: "w-64 min-w-56 max-w-72",
  creator: "w-48 min-w-40 max-w-56",
  favorite: "w-24 min-w-24 text-center",
  type: "w-28 min-w-28",
  year: "w-24 min-w-24 text-center",
  releaseStatus: "w-36 min-w-36",
  status: "w-36 min-w-36",
  genres: "w-64 min-w-56 max-w-72",
  progress: "w-48 min-w-48",
  rating: "w-28 min-w-28 text-center",
  studios: "w-56 min-w-48 max-w-64",
  country: "w-52 min-w-44 max-w-60",
  audience: "w-40 min-w-36",
  addedAt: "w-40 min-w-40",
  trackedOn: "w-40 min-w-40",
}

const dateFormatter = new Intl.DateTimeFormat("ar", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

const numberFormatter = new Intl.NumberFormat("ar")
const ratingFormatter = new Intl.NumberFormat("ar", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function WorkTable({
  works,
  selectedId,
  onOpen,
  columns,
  density = "comfortable",
}: WorkTableProps) {
  const translations = useArabicTranslations()
  const styles = densityClasses[density]
  const visibleColumns = tableColumnIds.filter((columnId) =>
    columns.includes(columnId)
  )
  const stickyColumn = columns.includes("title")
    ? "title"
    : columns.includes("artwork")
      ? "artwork"
      : null

  if (visibleColumns.length === 0) {
    return (
      <div
        role="status"
        className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm"
      >
        اختر عمودًا واحدًا على الأقل لعرض الجدول.
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      role="region"
      aria-label="جدول الأعمال"
      tabIndex={0}
      className="overflow-x-auto rounded-xl border bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 *:data-[slot=table-container]:overflow-visible"
    >
      <Table className="min-w-max" data-density={density}>
        <TableCaption className="sr-only">
          {`قائمة الأعمال، ${numberFormatter.format(works.length)} عمل`}
        </TableCaption>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {visibleColumns.map((columnId, index) => (
              <TableHead
                key={columnId}
                scope="col"
                className={cn(
                  styles.header,
                  columnClasses[columnId],
                  "px-3 text-xs font-medium text-muted-foreground",
                  index === 0 && "ps-4 sm:ps-5",
                  index === visibleColumns.length - 1 && "pe-4 sm:pe-5",
                  columnId === stickyColumn &&
                    "sticky inset-s-0 z-20 border-e bg-muted shadow-sm"
                )}
              >
                {tableColumnLabels[columnId]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {works.map((work) => {
            const selected = selectedId === work.id
            const title = work.arabicTitle || work.title

            return (
              <TableRow
                key={work.id}
                role="button"
                tabIndex={0}
                aria-label={`فتح تفاصيل ${title}`}
                aria-current={selected ? "true" : undefined}
                data-state={selected ? "selected" : undefined}
                onClick={() => onOpen(work.id)}
                onKeyDown={(event) => handleRowKeyDown(event, work.id, onOpen)}
                className="group/row cursor-pointer outline-none focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {visibleColumns.map((columnId, index) => (
                  <TableCell
                    key={columnId}
                    className={cn(
                      styles.cell,
                      columnClasses[columnId],
                      index === 0 && "ps-4 sm:ps-5",
                      index === visibleColumns.length - 1 && "pe-4 sm:pe-5",
                      columnId === stickyColumn &&
                        "sticky inset-s-0 z-10 border-e bg-card shadow-sm transition-colors group-hover/row:bg-muted/50 group-focus-visible/row:bg-accent/50 group-data-[state=selected]/row:bg-muted"
                    )}
                  >
                    {renderCell(columnId, work, density, translations)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function renderCell(
  columnId: TableColumnId,
  work: Work,
  density: TableDensity,
  translations: ReturnType<typeof useArabicTranslations>
) {
  const styles = densityClasses[density]

  switch (columnId) {
    case "artwork":
      return (
        <div
          className={cn(
            "aspect-2/3 shrink-0 overflow-hidden border bg-muted",
            styles.artwork
          )}
          aria-hidden="true"
        >
          {work.imagePath ? (
            <img
              className="size-full object-cover"
              src={work.imagePath}
              alt=""
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-4" />
            </div>
          )}
        </div>
      )

    case "title": {
      const primaryTitle = work.arabicTitle || work.title
      const secondaryTitle = work.arabicTitle ? work.title : null

      return (
        <div className="max-w-72 min-w-0">
          <p className="truncate text-sm font-semibold" title={primaryTitle}>
            {primaryTitle}
          </p>
          {secondaryTitle && secondaryTitle !== primaryTitle && (
            <p
              dir="auto"
              className={cn(
                "truncate text-muted-foreground",
                styles.secondaryText
              )}
              title={secondaryTitle}
            >
              {secondaryTitle}
            </p>
          )}
        </div>
      )
    }

    case "creator":
      return work.creator ? (
        <span className="block max-w-56 truncate" title={work.creator}>
          {work.creator}
        </span>
      ) : (
        <MutedValue>منشئ غير معروف</MutedValue>
      )

    case "favorite": {
      const label = work.favorite ? "مفضّل" : "غير مفضّل"

      return (
        <Badge
          variant={work.favorite ? "default" : "outline"}
          aria-label={label}
          title={label}
        >
          <HeartIcon weight={work.favorite ? "fill" : "regular"} />
          <span className="sr-only">{label}</span>
        </Badge>
      )
    }

    case "type":
      return <Badge variant="outline">{kindLabels[work.kind]}</Badge>

    case "year":
      return work.year === null ? (
        <EmptyValue />
      ) : (
        <span className="tabular-nums">
          {numberFormatter.format(work.year)}
        </span>
      )

    case "releaseStatus":
      return (
        <Badge variant="outline">
          {translations.facetValueLabel("releaseStatuses", work.releaseStatus)}
        </Badge>
      )

    case "status":
      return (
        <Badge
          variant={work.status === "in-progress" ? "default" : "secondary"}
        >
          {statusLabelsAr[work.status]}
        </Badge>
      )

    case "genres":
      return (
        <BadgeList
          values={work.genres}
          getLabel={(genre) => translations.taxonomyLabel("genre", genre)}
          limit={density === "compact" ? 1 : 2}
        />
      )

    case "progress": {
      if (!usesProgress(work)) return <EmptyValue />

      const percentage = progressPercentage(work)

      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {progressText(work)}
          </span>
          {percentage !== null && (
            <Badge variant="outline" className="tabular-nums">
              {numberFormatter.format(percentage)}٪
            </Badge>
          )}
        </div>
      )
    }

    case "rating":
      return work.calculatedRating === null ? (
        <EmptyValue />
      ) : (
        <Badge variant="secondary">
          <StarIcon weight="fill" />
          <span className="tabular-nums">
            {ratingFormatter.format(work.calculatedRating)}
          </span>
        </Badge>
      )

    case "studios":
      return (
        <BadgeList
          values={work.studios}
          getLabel={(studio) => studio}
          limit={density === "compact" ? 1 : 2}
        />
      )

    case "country":
      return (
        <BadgeList
          values={work.country}
          getLabel={(country) => translations.taxonomyLabel("country", country)}
          limit={density === "compact" ? 1 : 2}
        />
      )

    case "audience":
      return work.audience ? (
        <Badge variant="secondary">
          {translations.taxonomyLabel("audience", work.audience)}
        </Badge>
      ) : (
        <EmptyValue />
      )

    case "addedAt":
      return <TimestampValue value={work.addedAt} />

    case "trackedOn":
      return work.trackedOn ? (
        <time
          dateTime={work.trackedOn}
          className="text-xs text-muted-foreground tabular-nums"
        >
          {formatDateOnly(work.trackedOn)}
        </time>
      ) : (
        <EmptyValue />
      )

    default:
      return assertNever(columnId)
  }
}

function BadgeList({
  values,
  getLabel,
  limit,
}: {
  values: readonly string[]
  getLabel: (value: string) => string
  limit: number
}) {
  if (values.length === 0) return <EmptyValue />

  const labels = values.map(getLabel)
  const overflow = labels.length - limit

  return (
    <div
      className="flex max-w-full items-center gap-1"
      title={labels.join("، ")}
    >
      {labels.slice(0, limit).map((label, index) => (
        <Badge key={`${values[index]}-${index}`} variant="secondary">
          <span className="max-w-28 truncate">{label}</span>
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge
          variant="outline"
          aria-label={`${numberFormatter.format(overflow)} عناصر إضافية`}
        >
          +{numberFormatter.format(overflow)}
        </Badge>
      )}
    </div>
  )
}

function TimestampValue({ value }: { value: number }) {
  const milliseconds = value < 10_000_000_000 ? value * 1_000 : value
  const date = new Date(milliseconds)

  if (Number.isNaN(date.valueOf())) return <EmptyValue />

  return (
    <time
      dateTime={date.toISOString()}
      className="text-xs text-muted-foreground tabular-nums"
    >
      {dateFormatter.format(date)}
    </time>
  )
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.valueOf())
    ? "تاريخ غير صالح"
    : dateFormatter.format(date)
}

function progressPercentage(work: Work) {
  if (work.progressTotal === null || work.progressTotal <= 0) return null
  return Math.round(Math.min(100, (work.progress / work.progressTotal) * 100))
}

function handleRowKeyDown(
  event: KeyboardEvent<HTMLTableRowElement>,
  workId: string,
  onOpen: (id: string) => void
) {
  if (event.key !== "Enter" && event.key !== " ") return
  event.preventDefault()
  onOpen(workId)
}

function EmptyValue() {
  return <span className="text-muted-foreground">—</span>
}

function MutedValue({ children }: { children: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>
}

function assertNever(value: never): never {
  throw new Error(`Unsupported table column: ${String(value)}`)
}
