import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowUpRightIcon, FilmIcon, LockKeyholeIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { DatabaseRow } from "./database-model";
import type { CatalogWork } from "./works-model";
import { workflowLabels, workName, workFormat, workStructure } from "./works-model";

export interface CatalogItem {
  work: CatalogWork;
  row: DatabaseRow;
}
interface ViewProps {
  items: CatalogItem[];
  selected: ReadonlySet<string>;
  onSelect: (id: string, checked: boolean) => void;
  disabled: boolean;
}
function Poster({ work }: { work: CatalogWork }) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const path = work.catalog.poster;
  return (
    <div className="flex aspect-2/3 size-full items-center justify-center overflow-hidden rounded-md bg-muted">
      {path?.startsWith("/media/") && path !== failedPath ? (
        <img
          src={path}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedPath(path)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <FilmIcon className="size-6" aria-hidden="true" />
          <span className="text-xs">بلا ملصق</span>
        </div>
      )}
    </div>
  );
}
function Names({ work }: { work: CatalogWork }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="min-w-0 text-sm font-semibold leading-6">
        <Link
          to="/database/works/$workId"
          params={{ workId: work.id }}
          className="line-clamp-2 w-full rounded-sm text-start outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          title={workName(work)}
        >
          {workName(work)}
        </Link>
      </h2>
      {work.title_ar && work.title_ar !== work.canonical_title && (
        <p
          className="truncate text-start font-utility text-xs text-muted-foreground"
          title={work.canonical_title}
        >
          <span dir="auto">{work.canonical_title}</span>
        </p>
      )}
    </div>
  );
}
function Metadata({ work }: { work: CatalogWork }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>{work.release_year ?? "بلا سنة"}</span>
      <span aria-hidden="true">·</span>
      <span>{workStructure(work)}</span>
      <span aria-hidden="true">·</span>
      <span>{workFormat(work)}</span>
    </p>
  );
}
function Selection({
  work,
  selected,
  onSelect,
  disabled,
}: {
  work: CatalogWork;
  selected: ReadonlySet<string>;
  onSelect: ViewProps["onSelect"];
  disabled: boolean;
}) {
  return (
    <Checkbox
      className={"size-5"}
      aria-label={`تحديد ${workName(work)}`}
      checked={selected.has(work.id)}
      disabled={disabled}
      onCheckedChange={(checked) => onSelect(work.id, checked)}
    />
  );
}
export function WorksGallery({
  items,
  selected,
  onSelect,
  disabled,
  size,
}: ViewProps & { size: number }) {
  return (
    <div
      className={cn(
        "catalog-gallery",
        size === 1 && "catalog-gallery-compact",
        size === 3 && "catalog-gallery-large",
        size === 4 && "catalog-gallery-largest",
      )}
    >
      {items.map(({ work }) => (
        <article
          key={work.id}
          className="group flex min-w-0 flex-col gap-3"
          aria-label={workName(work)}
        >
          <div
            className={cn(
              "relative rounded-md",
              selected.has(work.id) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            <Link
              to="/database/works/$workId"
              params={{ workId: work.id }}
              aria-label={`فتح ${workName(work)}`}
              className="block aspect-2/3 w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Poster work={work} />
            </Link>
            <div className="absolute inset-s-2 top-2 flex items-center rounded-lg! bg-background cursor-pointer">
              <Selection work={work} selected={selected} onSelect={onSelect} disabled={disabled} />
            </div>
            <div className="absolute inset-e-2 top-2 flex flex-col items-end gap-1">
              {work.workflow_status !== "published" && (
                <Badge variant="secondary">{workflowLabels[work.workflow_status]}</Badge>
              )}
              {work.is_private && (
                <Badge variant="secondary">
                  <LockKeyholeIcon data-icon="inline-start" />
                  خاص
                </Badge>
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Names work={work} />
            {/*<Metadata work={work} />*/}
          </div>
        </article>
      ))}
    </div>
  );
}
export function WorksList({ items, selected, onSelect, disabled }: ViewProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map(({ work }) => (
        <article
          key={work.id}
          aria-label={workName(work)}
          className={cn(
            "flex min-w-0 items-start gap-4 rounded-lg border bg-card p-4",
            selected.has(work.id) && "border-primary",
          )}
        >
          <Link
            to="/database/works/$workId"
            params={{ workId: work.id }}
            className="w-20 shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-24"
            aria-label={`فتح ${workName(work)}`}
          >
            <Poster work={work} />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Names work={work} />
            <Metadata work={work} />
            {work.summary && (
              <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">{work.summary}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{workflowLabels[work.workflow_status]}</Badge>
              {work.is_private && <Badge variant="outline">خاص</Badge>}
              <span className="text-xs text-muted-foreground">
                {work.catalog.installments} جزء
                {work.catalog.episodes > 0 ? ` · ${work.catalog.episodes} حلقة` : ""}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-4">
            <Selection work={work} selected={selected} onSelect={onSelect} disabled={disabled} />
            <Link
              to="/database/works/$workId"
              params={{ workId: work.id }}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              aria-label={`فتح سجل ${workName(work)}`}
            >
              <ArrowUpRightIcon data-icon="inline-start" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
export function WorksTable({ items, selected, onSelect, disabled }: ViewProps) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border">
      <Table className="table-fixed min-w-md">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">تحديد</span>
            </TableHead>
            <TableHead>العمل</TableHead>
            <TableHead className="w-28">حالة النشر</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">فتح</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(({ work }) => (
            <TableRow key={work.id} data-state={selected.has(work.id) ? "selected" : undefined}>
              <TableCell>
                <Selection
                  work={work}
                  selected={selected}
                  onSelect={onSelect}
                  disabled={disabled}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <Link
                    to="/database/works/$workId"
                    params={{ workId: work.id }}
                    className="w-12 shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`فتح ملصق ${workName(work)}`}
                  >
                    <Poster work={work} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Names work={work} />
                    <Metadata work={work} />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-2">
                  <Badge variant="secondary">{workflowLabels[work.workflow_status]}</Badge>
                  {work.is_private && <Badge variant="outline">خاص</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <Link
                  to="/database/works/$workId"
                  params={{ workId: work.id }}
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                  aria-label="فتح العمل"
                >
                  <ArrowUpRightIcon data-icon="inline-start" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
