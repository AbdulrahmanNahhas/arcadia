import { StarIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { kindLabels } from "../filtering"
import type { Work } from "../model"
import { statusLabelsAr, useArabicTranslations } from "../translations"
import { progressText, usesProgress } from "./work-artwork"

export function WorkTable({
  works,
  selectedId,
  onOpen,
  columns,
}: {
  works: Work[]
  selectedId: string | null
  onOpen: (id: string) => void
  columns: string[]
}) {
  const { taxonomyLabel } = useArabicTranslations()
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/35">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 pl-4 text-[11px] tracking-wider uppercase">
              العمل
            </TableHead>
            {columns.includes("type") && <TableHead>النوع</TableHead>}
            {columns.includes("year") && <TableHead>السنة</TableHead>}
            {columns.includes("status") && <TableHead>الحالة</TableHead>}
            {columns.includes("genres") && <TableHead>التصنيفات</TableHead>}
            {columns.includes("progress") && <TableHead>التقدم</TableHead>}
            {columns.includes("rating") && (
              <TableHead className="pr-4 text-right">التقييم</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {works.map((work) => (
            <TableRow
              key={work.id}
              tabIndex={0}
              onClick={() => onOpen(work.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpen(work.id)
              }}
              className={cn(
                "cursor-pointer outline-none focus-visible:bg-accent/50",
                selectedId === work.id && "bg-primary/5"
              )}
            >
              <TableCell className="pl-4">
                <div className="flex min-w-56 items-center gap-3">
                  <div className="mini-cover h-14 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {work.imagePath ? (
                      <img
                        className="size-full object-cover"
                        src={work.imagePath}
                        alt=""
                      />
                    ) : (
                      <div className="size-full bg-linear-to-br from-primary/10 to-primary/40" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {work.arabicTitle || work.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {work.creator || "المنشئ غير معروف"}
                    </p>
                  </div>
                </div>
              </TableCell>
              {columns.includes("type") && (
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {kindLabels[work.kind]}
                  </Badge>
                </TableCell>
              )}
              {columns.includes("year") && (
                <TableCell className="text-muted-foreground tabular-nums">
                  {work.year ?? "—"}
                </TableCell>
              )}
              {columns.includes("status") && (
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        work.status === "completed" && "bg-emerald-500",
                        work.status === "in-progress" && "bg-blue-500",
                        work.status === "planned" && "bg-slate-400",
                        work.status === "paused" && "bg-amber-500",
                        work.status === "dropped" && "bg-rose-500"
                      )}
                    />
                    {statusLabelsAr[work.status]}
                  </span>
                </TableCell>
              )}
              {columns.includes("genres") && (
                <TableCell>
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {work.genres.slice(0, 2).map((genre) => (
                      <Badge
                        key={genre}
                        variant="secondary"
                        className="font-normal"
                      >
                        {taxonomyLabel("genre", genre)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              )}
              {columns.includes("progress") && (
                <TableCell className="text-xs text-muted-foreground">
                  {usesProgress(work) ? progressText(work) : "—"}
                </TableCell>
              )}
              {columns.includes("rating") && (
                <TableCell className="pr-4 text-right font-medium tabular-nums">
                  {work.calculatedRating !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <StarIcon
                        className="size-3 text-amber-500"
                        weight="fill"
                      />
                      {work.calculatedRating.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
