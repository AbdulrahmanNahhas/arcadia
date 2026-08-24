import { SlidersHorizontalIcon, StarIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { releaseStatusLabelsAr } from "@/features/catalog/catalog-grouping";
import { taxonomyLabels, type Work } from "@/features/library/model";
import { usePersistedState } from "@/lib/use-persisted-state";
import { kindLabel as workKindLabel } from "./work-card";

type ColumnId =
  | "kind"
  | "year"
  | "releaseStatus"
  | "audience"
  | "age"
  | "rating"
  | "duration"
  | "genres"
  | "tone"
  | "studios"
  | "country"
  | "tags"
  | "warnings";

type ColumnDef = {
  label: string;
  render: (work: Work) => React.ReactNode;
};

const optionalColumns: readonly ColumnId[] = [
  "kind",
  "year",
  "releaseStatus",
  "audience",
  "age",
  "rating",
  "duration",
  "genres",
  "tone",
  "studios",
  "country",
  "tags",
  "warnings",
];

const defaultVisibleColumns: readonly ColumnId[] = [
  "kind",
  "year",
  "releaseStatus",
  "audience",
  "rating",
  "genres",
  "studios",
];

function durationText(work: Work) {
  if (work.episodeCount !== null && work.episodeCount >= 1) return `${work.episodeCount} حلقة`;
  if (work.runtimeMinutes && work.runtimeMinutes >= 1) return `${work.runtimeMinutes} دقيقة`;
  if (work.chapterCount !== null && work.chapterCount >= 1) return `${work.chapterCount} فصل`;
  return "—";
}

function ListPreview({ values, max = 2 }: { values: string[]; max?: number }) {
  if (!values.length) return <span className="text-muted-foreground">—</span>;
  const shown = values.slice(0, max);
  const rest = values.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((value) => (
        <Badge key={value} variant="outline" className="whitespace-nowrap">
          {value}
        </Badge>
      ))}
      {rest > 0 ? <span className="text-xs text-muted-foreground">+{rest}</span> : null}
    </div>
  );
}

const columns = {
  kind: {
    label: "النوع",
    render: (work) => workKindLabel[work.kind],
  },
  year: {
    label: "السنة",
    render: (work) => work.year ?? "—",
  },
  releaseStatus: {
    label: "حالة العرض",
    render: (work) => (
      <Badge variant="outline">
        {releaseStatusLabelsAr[work.releaseStatus] ?? work.releaseStatus}
      </Badge>
    ),
  },
  audience: {
    label: "الجمهور",
    render: (work) => (work.audience ? taxonomyLabels.audiences[work.audience] : "—"),
  },
  age: {
    label: "الفئة العمرية",
    render: (work) => (work.age ? taxonomyLabels.ages[work.age] : "—"),
  },
  rating: {
    label: "التقييم",
    render: (work) =>
      work.calculatedRating === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="inline-flex items-center gap-1 font-medium">
          <StarIcon weight="fill" className="size-3.5 text-amber-500" />
          {work.calculatedRating.toFixed(1)}
        </span>
      ),
  },
  duration: {
    label: "المدة",
    render: durationText,
  },
  genres: {
    label: "التصنيفات",
    render: (work) => <ListPreview values={work.genres} />,
  },
  tone: {
    label: "الطابع",
    render: (work) => <ListPreview values={work.tone} />,
  },
  studios: {
    label: "الاستوديو",
    render: (work) => <ListPreview values={work.studios} />,
  },
  country: {
    label: "الدولة",
    render: (work) => <ListPreview values={work.country} />,
  },
  tags: {
    label: "الوسوم",
    render: (work) => <ListPreview values={work.tags} max={3} />,
  },
  warnings: {
    label: "التحذيرات",
    render: (work) =>
      work.contentWarnings ? (
        <Badge variant="destructive">به تحذيرات</Badge>
      ) : (
        <span className="text-muted-foreground">لا يوجد</span>
      ),
  },
} satisfies Record<ColumnId, ColumnDef>;

export function useWorkTableColumns() {
  return usePersistedState<ColumnId[]>("arcadia:browse:table-columns", [...defaultVisibleColumns]);
}

export function WorkTableColumnPicker({
  visible,
  onChange,
}: {
  visible: ColumnId[];
  onChange: (columns: ColumnId[]) => void;
}) {
  const toggle = (id: ColumnId) =>
    onChange(visible.includes(id) ? visible.filter((column) => column !== id) : [...visible, id]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <SlidersHorizontalIcon data-icon="inline-start" />
            الأعمدة
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <PopoverHeader>
          <PopoverTitle>أعمدة الجدول</PopoverTitle>
          <PopoverDescription>اختر ما تريد إظهاره إلى جانب العنوان.</PopoverDescription>
        </PopoverHeader>
        <div className="flex max-h-80 flex-col gap-2.5 overflow-y-auto">
          {optionalColumns.map((id) => {
            const inputId = `browse-table-column-${id}`;
            return (
              <label key={id} htmlFor={inputId} className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  id={inputId}
                  checked={visible.includes(id)}
                  onCheckedChange={() => toggle(id)}
                />
                {columns[id].label}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getTitleInfo(work: Work) {
  const officialTitle = work.arabicTitle || work.title;
  const displayTitle = work.installmentTitle || officialTitle;
  const parentTitle =
    work.installmentTitle && work.installmentTitle !== officialTitle ? officialTitle : null;
  return { displayTitle, parentTitle };
}

export function WorkTable({
  works,
  columns: visibleColumns,
}: {
  works: Work[];
  columns: ColumnId[];
}) {
  const activeColumns = optionalColumns.filter((id) => visibleColumns.includes(id));
  return (
    <div className="overflow-hidden rounded-2xl border bg-card/35 backdrop-blur-xl">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>العنوان</TableHead>
            {activeColumns.map((id) => (
              <TableHead key={id}>{columns[id].label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {works.map((work) => {
            const { displayTitle, parentTitle } = getTitleInfo(work);
            return (
              <TableRow key={`${work.installmentId ?? work.id}`} className="group/row">
                <TableCell className="max-w-72 whitespace-normal">
                  <Link
                    to="/titles/$titleId"
                    params={{ titleId: work.id }}
                    className="flex min-w-0 flex-col outline-none focus-visible:underline"
                  >
                    {parentTitle ? (
                      <span className="truncate text-xs text-muted-foreground/75">
                        {parentTitle}
                      </span>
                    ) : null}
                    <span className="truncate font-heading font-medium group-hover/row:text-primary">
                      {displayTitle}
                    </span>
                  </Link>
                </TableCell>
                {activeColumns.map((id) => (
                  <TableCell key={id}>{columns[id].render(work)}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
