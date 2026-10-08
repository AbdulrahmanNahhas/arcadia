import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArrowRightIcon,
  Building2Icon,
  FilmIcon,
  GlobeIcon,
  ListOrderedIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  UserIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { z } from "zod";

import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogContributionEditor } from "@/features/catalog/entities/catalog-contribution-editor";
import type { CatalogKind, CatalogDetail } from "@/features/catalog/entities/catalog-model";
import { CatalogRecordForm } from "@/features/catalog/entities/catalog-record-form";
import {
  getCatalogDetail,
  getCatalogPage,
  movePlanetWorks,
} from "@/features/catalog/entities/catalog.functions";
import { CatalogSelect } from "@/features/catalog/works/works-toolbar";
import type { DatabaseRow, DatabaseTable } from "@/features/database/data/database-model";
import { mutateDatabaseRecord } from "@/features/database/data/database.functions";
import { databaseSchemaOptions, databaseKeys } from "@/features/database/data/database.queries";
import type { JsonValue } from "@/features/editor/json/document/document-model";
import { ReferenceField } from "@/features/editor/references/reference-field";
import { workScoreVersion } from "@/features/scoring/score-model";
import { WorkScoreBadge } from "@/features/scoring/work-score";

const copy = {
  people: {
    title: "الأشخاص",
    singular: "الشخص",
    add: "إضافة شخص",
    description: "الوجوه خلف الأعمال؛ الأسماء البديلة والأدوار والمساهمات في مكان واحد.",
    memberTitle: "الأعمال والمساهمات",
    imageTitle: "صور الشخص",
    icon: UserIcon,
  },
  studios: {
    title: "الاستوديوهات",
    singular: "الاستوديو",
    add: "إضافة استوديو",
    description: "المؤسسات التي صنعت المكتبة؛ أعمالها وأدوارها وصلاتها بالمؤسسات الأخرى.",
    memberTitle: "أعمال الاستوديو",
    imageTitle: "الشعارات والصور",
    icon: Building2Icon,
  },
  planets: {
    title: "العوالم",
    singular: "العالم",
    add: "إضافة عالم",
    description: "رتّب الأعمال داخل عوالمها، ميّز العناوين الأساسية، وانقل مجموعات إلى عالم آخر.",
    memberTitle: "أعمال العالم",
    imageTitle: "صور أعمال العالم",
    icon: GlobeIcon,
  },
};
const catalogSortChoices = [
  { value: "name", label: "الاسم" },
  { value: "related", label: "الأكثر ارتباطاً" },
  { value: "updated", label: "آخر تعديل" },
] as const;
const catalogImageChoices = [
  { value: "with-image", label: "له صورة" },
  { value: "without-image", label: "بلا صورة" },
] as const;
const planetStatusChoices = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "متوقف" },
] as const;
function text(value: JsonValue | undefined) {
  return z.union([z.string(), z.number()]).safeParse(value).data?.toString() ?? "";
}
function name(row: DatabaseRow) {
  return text(row.name_ar ?? row.name);
}
function ImagePreview({
  path,
  title,
  kind,
}: {
  path?: string | null;
  title: string;
  kind: CatalogKind;
}) {
  const Icon = copy[kind].icon;
  return path?.startsWith("/media/") ? (
    <img
      src={path}
      alt={title}
      loading="lazy"
      className={cn(
        "w-full object-contain",
        kind === "people" && "aspect-3/4",
        kind === "studios" && "aspect-square",
        kind === "planets" && "aspect-2/3",
      )}
    />
  ) : (
    <div
      className={cn(
        "flex items-center justify-center bg-muted",
        kind === "people" && "aspect-3/4",
        kind === "studios" && "aspect-square",
        kind === "planets" && "aspect-2/3",
      )}
    >
      <Icon className="size-10 text-muted-foreground" />
      <span className="sr-only">لا توجد صورة</span>
    </div>
  );
}
function EntityAvatar({
  path,
  title,
  kind,
}: {
  path: string | null;
  title: string;
  kind: CatalogKind;
}) {
  const Icon = kind === "people" ? UserIcon : Building2Icon;
  const avatarClassName = kind === "people" ? "size-12 rounded-full" : "size-12 rounded-md";
  return path?.startsWith("/media/") ? (
    <img
      src={path}
      alt={title}
      loading="lazy"
      className={cn(avatarClassName, "shrink-0 object-contain p-px bg-white")}
    />
  ) : (
    <span
      className={cn(
        avatarClassName,
        "flex shrink-0 items-center justify-center bg-white p-1 text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      <span className="sr-only">لا توجد صورة</span>
    </span>
  );
}
function planetGlyph(value: string) {
  if (/\p{Extended_Pictographic}/u.test(value)) return value;
  const symbols = {
    earth: "🌍",
    globe: "🌍",
    moon: "🌙",
    mars: "🔴",
    saturn: "🪐",
    sun: "☀️",
    star: "✨",
    stars: "✨",
    sparkles: "✨",
  } satisfies Record<string, string>;
  return Object.entries(symbols).find(([symbol]) => symbol === value.toLowerCase())?.[1] ?? "🪐";
}
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

function PlanetColors({ row }: { row: DatabaseRow }) {
  const primary = text(row.primary_color);
  const secondary = text(row.secondary_color);
  return (
    <div className="flex items-center gap-2" role="group" aria-label="ألوان العالم">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {colorSchema.safeParse(primary).success ? (
          <svg
            viewBox="0 0 20 20"
            className="size-5 rounded-full ring-1 ring-foreground/20"
            role="img"
            aria-label={`اللون الأساسي ${primary}`}
          >
            <circle cx="10" cy="10" r="10" fill={primary} />
          </svg>
        ) : (
          <Badge variant="outline">—</Badge>
        )}
        أساسي
      </span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {colorSchema.safeParse(secondary).success ? (
          <svg
            viewBox="0 0 20 20"
            className="size-5 rounded-full ring-1 ring-foreground/20"
            role="img"
            aria-label={`اللون الثانوي ${secondary}`}
          >
            <circle cx="10" cy="10" r="10" fill={secondary} />
          </svg>
        ) : (
          <Badge variant="outline">—</Badge>
        )}
        ثانوي
      </span>
    </div>
  );
}
function PlanetIdentity({ row }: { row: DatabaseRow }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-5 border-y py-5">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-3xl"
          aria-hidden="true"
        >
          {planetGlyph(text(row.icon))}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">هوية العالم</h2>
          <p className="text-sm text-muted-foreground">{text(row.name_en) || text(row.slug)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(row.description) || "لا يوجد وصف لهذا العالم بعد"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <PlanetColors row={row} />
      </div>
    </section>
  );
}
function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>تعذّر تحميل البيانات</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <Button variant="outline" onClick={retry}>
        إعادة المحاولة
      </Button>
    </Alert>
  );
}
function Search({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </InputGroup>
  );
}
function Pager({
  offset,
  total,
  pending,
  onChange,
}: {
  offset: number;
  total: number;
  pending: boolean;
  onChange: (offset: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {total ? `${offset + 1}–${Math.min(offset + 50, total)} من ${total}` : "لا توجد نتائج"}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!offset || pending}
          onClick={() => onChange(Math.max(0, offset - 50))}
        >
          السابق
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={offset + 50 >= total || pending}
          onClick={() => onChange(offset + 50)}
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const search = useSearch({ from: "__root__" });
  const navigate = useNavigate();
  const schema = useQuery(databaseSchemaOptions());
  const table = schema.data?.find(
    (item) => item.name === (kind === "planets" ? "planets" : "entities"),
  );
  const query = useQuery({
    queryKey: [
      "database",
      "catalog",
      kind,
      search.q ?? "",
      search.offset ?? 0,
      search.catalogSort ?? "name",
      search.catalogImage ?? "all",
      search.planetStatus ?? "all",
    ],
    queryFn: ({ signal }) =>
      getCatalogPage({
        data: {
          kind,
          search: search.q ?? "",
          offset: search.offset ?? 0,
          sort: search.catalogSort ?? "name",
          imageFilter: search.catalogImage ?? "all",
          planetFilter: search.planetStatus ?? "all",
        },
        signal,
      }),
    enabled: !search.record,
  });
  const [creating, setCreating] = useState(false);
  const info = copy[kind];
  function setSearch(q: string, offset = 0) {
    void navigate({
      to: "/database/$collection",
      params: { collection: kind },
      search: {
        q: q || undefined,
        offset,
        catalogSort: search.catalogSort,
        catalogImage: search.catalogImage,
        planetStatus: search.planetStatus,
      },
    });
  }
  function setCatalogFilter(
    patch: Partial<Pick<typeof search, "catalogSort" | "catalogImage" | "planetStatus">>,
  ) {
    void navigate({
      to: "/database/$collection",
      params: { collection: kind },
      search: {
        q: search.q,
        offset: 0,
        catalogSort: search.catalogSort,
        catalogImage: search.catalogImage,
        planetStatus: search.planetStatus,
        ...patch,
      },
    });
  }
  const listSearch = {
    q: search.q,
    offset: search.offset,
    catalogSort: search.catalogSort,
    catalogImage: search.catalogImage,
    planetStatus: search.planetStatus,
  };
  if (search.record)
    return <CatalogDetailPage key={`${kind}-${search.record}`} kind={kind} id={search.record} />;
  return (
    <>
      <PageHeader
        title={info.title}
        description={info.description}
        actions={
          <Button disabled={!table?.writable} onClick={() => setCreating(true)}>
            <PlusIcon data-icon="inline-start" />
            {info.add}
          </Button>
        }
      />
      <FieldGroup className="flex flex-row flex-wrap items-center">
        <div className="min-w-48 flex-1 basis-64">
          <Search
            value={search.q ?? ""}
            label={`ابحث في ${info.title}…`}
            onChange={(q) => setSearch(q)}
          />
        </div>
        <CatalogSelect
          label="ترتيب حسب"
          value={search.catalogSort ?? "name"}
          choices={catalogSortChoices.map((choice) => ({
            ...choice,
            label:
              choice.value === "related"
                ? kind === "planets"
                  ? "عدد الأعمال"
                  : "عدد الأعمال"
                : choice.label,
          }))}
          onChange={(catalogSort) => setCatalogFilter({ catalogSort: catalogSort ?? "name" })}
        />
        {kind === "planets" ? (
          <CatalogSelect
            label="حالة العالم"
            value={search.planetStatus === "all" ? undefined : search.planetStatus}
            choices={planetStatusChoices}
            onChange={(planetStatus) => setCatalogFilter({ planetStatus: planetStatus ?? "all" })}
          />
        ) : (
          <CatalogSelect
            label="الصور"
            value={search.catalogImage === "all" ? undefined : search.catalogImage}
            choices={catalogImageChoices}
            onChange={(catalogImage) => setCatalogFilter({ catalogImage: catalogImage ?? "all" })}
          />
        )}
      </FieldGroup>
      {schema.isError && (
        <Failure message={schema.error.message} retry={() => void schema.refetch()} />
      )}
      {query.isError && (
        <Failure message={query.error.message} retry={() => void query.refetch()} />
      )}
      {query.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-80" />
          ))}
        </div>
      )}
      {query.data && (
        <>
          {!query.data.items.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد نتائج</EmptyTitle>
                <EmptyDescription>غيّر عبارة البحث أو أضف {info.singular} جديداً.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {kind === "planets" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {query.data.items.map((item) => (
                <Link
                  to="/database/$collection"
                  params={{ collection: kind }}
                  search={{ ...listSearch, record: text(item.row.id) }}
                  key={text(item.row.id)}
                  className="group relative isolate flex min-h-52 flex-col justify-between overflow-hidden rounded-xl p-5 text-foreground transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 420 260"
                    preserveAspectRatio="none"
                    className="absolute inset-0 -z-10 size-full"
                  >
                    <defs>
                      <linearGradient
                        id={`planet-${text(item.row.id)}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop
                          stopColor={
                            colorSchema.safeParse(text(item.row.primary_color)).success
                              ? text(item.row.primary_color)
                              : "currentColor"
                          }
                        />
                        <stop
                          offset="1"
                          stopColor={
                            colorSchema.safeParse(text(item.row.secondary_color)).success
                              ? text(item.row.secondary_color)
                              : "currentColor"
                          }
                        />
                      </linearGradient>
                    </defs>
                    <rect width="420" height="260" fill={`url(#planet-${text(item.row.id)})`} />
                    <circle cx="355" cy="24" r="132" fill="currentColor" opacity="0.09" />
                    <circle cx="388" cy="214" r="92" fill="currentColor" opacity="0.12" />
                  </svg>
                  <div className="relative flex items-start justify-between gap-3">
                    <span
                      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-background/20 text-4xl backdrop-blur-sm"
                      aria-hidden="true"
                    >
                      {planetGlyph(text(item.row.icon))}
                    </span>
                    <span className="rounded-full bg-background/30 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                      {item.row.is_active === true ? "نشط" : "متوقف"}
                    </span>
                  </div>
                  <div className="relative flex items-end justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{name(item.row)}</span>
                      <span className="block truncate text-xs opacity-80">
                        {text(item.row.slug)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium">{item.relatedCount} عمل</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {query.data.items.map((item) => (
                <Link
                  to="/database/$collection"
                  params={{ collection: kind }}
                  search={{ ...listSearch, record: text(item.row.id) }}
                  key={text(item.row.id)}
                  className="group flex min-w-0 items-center gap-4 border py-3 transition-colors rounded-lg px-3 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  <EntityAvatar path={item.image} title={name(item.row)} kind={kind} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover:text-primary">
                      {name(item.row)}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                      {text(item.row.description) || "لا يوجد تعريف بعد"}
                    </span>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {item.relatedCount} عملاً
                  </Badge>
                </Link>
              ))}
            </div>
          )}
          {kind !== "planets" && (
            <Pager
              offset={search.offset ?? 0}
              total={query.data.total}
              pending={query.isFetching}
              onChange={(offset) => setSearch(search.q ?? "", offset)}
            />
          )}
        </>
      )}
      {creating && table && (
        <EditDialog
          title={info.add}
          table={table}
          row={null}
          defaults={
            kind === "planets"
              ? { icon: "globe", primary_color: "#1b5ad7", secondary_color: "#5d718a" }
              : { kind: kind === "people" ? "person" : "organization" }
          }
          onClose={() => setCreating(false)}
          onSaved={(row) => {
            setCreating(false);
            void navigate({
              to: "/database/$collection",
              params: { collection: kind },
              search: { record: text(row.id) },
            });
          }}
        />
      )}
    </>
  );
}
type EditState = {
  title: string;
  table: string;
  row: DatabaseRow | null;
  defaults?: DatabaseRow;
  hidden?: string[];
};
function EditDialog({
  title,
  table,
  row,
  defaults,
  hidden,
  onClose,
  onSaved,
}: {
  title: string;
  table: DatabaseTable;
  row: DatabaseRow | null;
  defaults?: DatabaseRow;
  hidden?: string[];
  onClose: () => void;
  onSaved: (row: DatabaseRow) => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            تُحفظ التغييرات عند الضغط على الحفظ وتظهر في سجل المراجعات.
          </DialogDescription>
        </DialogHeader>
        <CatalogRecordForm
          key={`${table.name}-${JSON.stringify(row ?? defaults ?? {})}`}
          table={table}
          row={row}
          defaults={defaults}
          hidden={hidden}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
function CatalogDetailPage({ kind, id }: { kind: CatalogKind; id: string }) {
  const routeSearch = useSearch({ from: "__root__" });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [confirmMove, setConfirmMove] = useState(false);
  const [notice, setNotice] = useState("");
  const schema = useQuery(databaseSchemaOptions());
  const query = useQuery({
    queryKey: ["database", "catalog", kind, id, workScoreVersion, { search }],
    queryFn: ({ signal }) => getCatalogDetail({ data: { kind, id, offset: 0, search }, signal }),
  });
  const client = useQueryClient();
  const info = copy[kind];
  const mainTable = schema.data?.find(
    (table) => table.name === (kind === "planets" ? "planets" : "entities"),
  );
  const editingTable = schema.data?.find((table) => table.name === editing?.table);
  const remove = useMutation({
    mutationFn: async ({ table, row }: { table: string; row: DatabaseRow }) => {
      const definition = schema.data?.find((item) => item.name === table);
      if (!definition?.writable) throw new Error("هذا السجل غير قابل للتعديل.");
      const key = Object.fromEntries(
        definition.columns
          .filter((column) => column.primary)
          .map((column) => [column.name, row[column.name] ?? null]),
      );
      return mutateDatabaseRecord({
        data: { table, operation: "delete", values: {}, key, original: row },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["database", "catalog"] }),
        client.invalidateQueries({ queryKey: databaseKeys.all }),
      ]);
      setNotice("أُزيل الربط. يبقى العمل في المكتبة.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const move = useMutation({
    mutationFn: () =>
      movePlanetWorks({
        data: {
          sourcePlanetId: id,
          targetPlanetId: destination,
          originals: (query.data?.members ?? [])
            .filter((member) => selected.includes(member.titleId))
            .map((member) => ({
              titleId: member.titleId,
              featuredRank: z.number().safeParse(member.row.featured_rank).data ?? null,
            })),
        },
      }),
    onSuccess: async (result) => {
      setSelected([]);
      setConfirmMove(false);
      setNotice(`نُقل ${result.moved} عمل إلى العالم المختار.`);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["database", "catalog"] }),
        client.invalidateQueries({ queryKey: databaseKeys.records("title_planets") }),
        client.invalidateQueries({ queryKey: databaseKeys.records("titles") }),
      ]);
    },
  });
  function edit(
    title: string,
    table: string,
    row: DatabaseRow | null,
    defaults?: DatabaseRow,
    hidden?: string[],
  ) {
    setEditing({ title, table, row, defaults, hidden });
  }
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError)
    return <Failure message={query.error.message} retry={() => void query.refetch()} />;
  const data = query.data;
  return (
    <>
      <PageHeader
        title={name(data.row)}
        description={
          kind === "planets" ? info.description : text(data.row.description) || info.description
        }
        eyebrow={info.title}
        actions={
          <Link
            to="/database/$collection"
            params={{ collection: kind }}
            search={{
              q: routeSearch.q,
              offset: routeSearch.offset,
              catalogSort: routeSearch.catalogSort,
              catalogImage: routeSearch.catalogImage,
              planetStatus: routeSearch.planetStatus,
            }}
            className={buttonVariants({ variant: "outline" })}
          >
            <ArrowRightIcon data-icon="inline-start" />
            {info.title}
          </Link>
        }
      />
      {kind === "planets" && <PlanetIdentity row={data.row} />}
      {notice && (
        <Alert>
          <AlertTitle>نتيجة العملية</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {schema.isError && (
        <Failure message={schema.error.message} retry={() => void schema.refetch()} />
      )}
      <Tabs defaultValue="works">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="works">
            {info.memberTitle} · {data.memberTotal}
          </TabsTrigger>
          <TabsTrigger value="identity">الهوية والتفاصيل</TabsTrigger>
          {kind !== "planets" && <TabsTrigger value="aliases">الأسماء البديلة</TabsTrigger>}
          {kind !== "planets" && <TabsTrigger value="images">{info.imageTitle}</TabsTrigger>}
          {kind === "studios" && <TabsTrigger value="relations">علاقات المؤسسات</TabsTrigger>}
        </TabsList>
        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل {info.singular}</CardTitle>
              <CardDescription>حقول منظمة ومحرر JSON لنفس السجل.</CardDescription>
            </CardHeader>
            <CardContent>
              {mainTable && (
                <CatalogRecordForm
                  key={JSON.stringify(data.row)}
                  table={mainTable}
                  row={data.row}
                  onSaved={() => setNotice("حُفظت التفاصيل.")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="works">
          <Card>
            <CardHeader>
              <CardTitle>{info.memberTitle}</CardTitle>
              <CardDescription>
                {kind === "people"
                  ? "الأدوار التي شارك بها الشخص، مع ترتيب المساهمة وتحديد المساهمات الرئيسية."
                  : kind === "studios"
                    ? "أضف عملاً ودور المؤسسة، أو حرّر المساهمة الحالية دون حذف العمل."
                    : "أضف أعمالاً، غيّر الترتيب المميز، أو انقل المختار إلى عالم آخر."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="sm"
                    disabled={!schema.data}
                    onClick={() =>
                      edit(
                        kind === "planets" ? "إضافة عمل إلى العالم" : "إضافة مساهمة",
                        kind === "planets" ? "title_planets" : "contributions",
                        null,
                        kind === "planets"
                          ? { planet_id: id, featured_rank: null }
                          : { entity_id: id, position: 0, is_primary: false },
                        kind === "planets" ? ["planet_id"] : ["entity_id"],
                      )
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    {kind === "planets" ? "إضافة عمل" : "إضافة مساهمة"}
                  </Button>
                  {kind === "planets" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelected(
                          selected.length === data.members.length
                            ? []
                            : data.members.map((member) => member.titleId),
                        )
                      }
                    >
                      {selected.length === data.members.length && data.members.length
                        ? "إلغاء تحديد الكل"
                        : "تحديد كل الأعمال"}
                    </Button>
                  )}
                </div>
                <Search
                  value={search}
                  label="البحث في الأعمال المرتبطة…"
                  onChange={(value) => {
                    setSearch(value);
                    setSelected([]);
                    setConfirmMove(false);
                  }}
                />
                {kind === "planets" && selected.length > 0 && (
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle>نقل {selected.length} عمل</CardTitle>
                      <CardDescription>
                        تنتقل العضوية إلى الوجهة ويُمسح ترتيب التمييز. تبقى عضوية العوالم الأخرى وكل
                        بيانات العمل محفوظة.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup>
                        <ReferenceField
                          label="العالم الجديد"
                          table="planets"
                          value={destination}
                          useIdValue
                          onChange={(value) => {
                            setDestination(value);
                            setConfirmMove(false);
                          }}
                        />
                      </FieldGroup>
                      {confirmMove && (
                        <Alert>
                          <AlertTitle>تأكيد نقل الأعمال المختارة</AlertTitle>
                          <AlertDescription>
                            راجع الوجهة ثم اضغط تأكيد النقل. تُنفّذ المجموعة كوحدة واحدة؛ وجود عضوية
                            مكررة أو تغيير حديث يوقف العملية.
                          </AlertDescription>
                        </Alert>
                      )}
                      {move.isError && (
                        <Alert variant="destructive">
                          <AlertTitle>لم تُنقل الأعمال</AlertTitle>
                          <AlertDescription>{move.error.message}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        disabled={!destination || destination === id || move.isPending}
                        onClick={() => {
                          if (confirmMove) move.mutate();
                          else setConfirmMove(true);
                        }}
                      >
                        {move.isPending
                          ? "جارٍ النقل…"
                          : confirmMove
                            ? "تأكيد النقل"
                            : "مراجعة النقل"}
                      </Button>
                    </CardFooter>
                  </Card>
                )}
                {!data.members.length && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>لا توجد أعمال مرتبطة</EmptyTitle>
                      <EmptyDescription>
                        أضف أول {kind === "planets" ? "عمل إلى هذا العالم" : "مساهمة لهذا السجل"} أو
                        غيّر البحث.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                <div className="grid gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {data.members.map((member) => (
                    <CatalogWorkCard
                      key={`${member.titleId}-${text(member.row.role_id ?? member.row.planet_id)}`}
                      member={member}
                      meta={
                        kind === "planets"
                          ? member.row.featured_rank === null
                            ? "غير مميز"
                            : `ترتيب مميز: ${text(member.row.featured_rank)}`
                          : (member.roleLabel ?? (kind === "people" ? "مساهمة" : "دور الاستوديو"))
                      }
                      status={
                        kind === "planets"
                          ? {
                              label:
                                member.row.featured_rank === null
                                  ? "غير مميز"
                                  : `مميز · ${text(member.row.featured_rank)}`,
                              featured: member.row.featured_rank !== null,
                            }
                          : undefined
                      }
                      top={
                        kind === "planets" ? (
                          <Checkbox
                            aria-label={`تحديد ${member.title}`}
                            checked={selected.includes(member.titleId)}
                            onCheckedChange={(checked) => {
                              setSelected((current) =>
                                checked
                                  ? [...current, member.titleId]
                                  : current.filter((value) => value !== member.titleId),
                              );
                              setConfirmMove(false);
                            }}
                          />
                        ) : undefined
                      }
                      actions={
                        kind === "planets" ? (
                          <>
                            <Button
                              className="min-w-0 flex-1"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                edit(`تحرير ${member.title}`, "title_planets", member.row)
                              }
                            >
                              <ListOrderedIcon data-icon="inline-start" />
                              الترتيب
                            </Button>
                            <UnlinkButton
                              disabled={remove.isPending}
                              label={member.title}
                              className="min-w-0 flex-1"
                              onConfirm={() =>
                                remove.mutate({ table: "title_planets", row: member.row })
                              }
                            />
                          </>
                        ) : (
                          <>
                            <Button
                              className="min-w-0 flex-1"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                edit(`تحرير ${member.title}`, "contributions", member.row)
                              }
                            >
                              <PencilIcon data-icon="inline-start" />
                              تحرير الدور
                            </Button>
                            <UnlinkButton
                              disabled={remove.isPending}
                              label={member.title}
                              className="min-w-0 flex-1"
                              onConfirm={() =>
                                remove.mutate({ table: "contributions", row: member.row })
                              }
                            />
                          </>
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {kind !== "planets" && (
          <TabsContent value="aliases">
            <Card>
              <CardHeader>
                <CardTitle>أسماء تُعرّف بهذا {info.singular}</CardTitle>
                <CardDescription>الأسماء المحلية والتهجئات البديلة تظهر في البحث.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {data.aliases.map((row) => (
                    <div
                      key={text(row.id)}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span dir="auto">
                        {text(row.alias)}{" "}
                        <Badge variant="outline">{text(row.language) || "دون لغة"}</Badge>
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            edit("تحرير الاسم البديل", "entity_aliases", row, { entity_id: id }, [
                              "entity_id",
                            ])
                          }
                        >
                          تحرير
                        </Button>
                        <UnlinkButton
                          label={text(row.alias)}
                          disabled={remove.isPending}
                          onConfirm={() => remove.mutate({ table: "entity_aliases", row })}
                        />
                      </div>
                    </div>
                  ))}
                  {!data.aliases.length && (
                    <p className="text-sm text-muted-foreground">لا توجد أسماء بديلة بعد.</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    edit("اسم بديل جديد", "entity_aliases", null, { entity_id: id }, ["entity_id"])
                  }
                >
                  <PlusIcon data-icon="inline-start" />
                  إضافة اسم بديل
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        )}
        {kind !== "planets" && (
          <TabsContent value="images">
            <CatalogImages
              kind={kind}
              data={data}
              onEdit={edit}
              onRemove={(row) => remove.mutate({ table: "media_asset_assignments", row })}
              pending={remove.isPending}
            />
          </TabsContent>
        )}
        {kind === "studios" && (
          <TabsContent value="relations">
            <Card>
              <CardHeader>
                <CardTitle>شبكة المؤسسات</CardTitle>
                <CardDescription>
                  العلاقة واتجاهها وتاريخها ووصفها، مثل الانتماء أو الشراكة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {data.relations.map((relation) => (
                    <div
                      key={text(relation.row.id)}
                      className="flex flex-col gap-2 rounded-lg border p-4"
                    >
                      <p>
                        {relation.sourceName} ← {relation.targetName}
                      </p>
                      <Badge variant="secondary">{text(relation.row.relation_type)}</Badge>
                      <p className="text-sm text-muted-foreground">
                        {text(relation.row.description)} {text(relation.row.occurred_on)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            edit("تحرير العلاقة", "organization_relations", relation.row)
                          }
                        >
                          تحرير
                        </Button>
                        <UnlinkButton
                          label={`${relation.sourceName} / ${relation.targetName}`}
                          disabled={remove.isPending}
                          onConfirm={() =>
                            remove.mutate({ table: "organization_relations", row: relation.row })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  {!data.relations.length && (
                    <p className="text-sm text-muted-foreground">
                      لا توجد علاقات بين المؤسسات لهذا الاستوديو.
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    edit("علاقة مؤسسة جديدة", "organization_relations", null, { source_id: id }, [
                      "source_id",
                    ])
                  }
                >
                  <PlusIcon data-icon="inline-start" />
                  إضافة علاقة
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      {editing?.table === "contributions" && editing.row ? (
        <CatalogContributionEditor
          title={editing.title}
          row={editing.row}
          onClose={() => setEditing(null)}
        />
      ) : (
        editing &&
        editingTable && (
          <EditDialog
            title={editing.title}
            table={editingTable}
            row={editing.row}
            defaults={editing.defaults}
            hidden={editing.hidden}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setNotice("حُفظت التغييرات.");
            }}
          />
        )
      )}
    </>
  );
}
function UnlinkButton({
  label,
  disabled,
  onConfirm,
  className,
}: {
  label: string;
  disabled: boolean;
  onConfirm: () => void;
  className?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Button
      size="sm"
      className={className}
      variant={confirm ? "destructive" : "outline"}
      disabled={disabled}
      aria-label={`${confirm ? "تأكيد إزالة" : "إزالة"} ${label}`}
      onClick={() => {
        if (confirm) {
          onConfirm();
          setConfirm(false);
        } else setConfirm(true);
      }}
    >
      {confirm ? "تأكيد الإزالة" : "إزالة"}
    </Button>
  );
}
function CatalogWorkCard({
  member,
  meta,
  status,
  top,
  actions,
}: {
  member: CatalogDetail["members"][number];
  meta: string;
  status?: { label: string; featured: boolean };
  top?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40">
      <div className="relative">
        <Link
          to="/database/works/$workId"
          params={{ workId: member.titleId }}
          aria-label={`فتح ${member.title}`}
          className="block overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {member.image?.startsWith("/media/") ? (
            <img
              src={member.image}
              alt={member.title}
              loading="lazy"
              className="aspect-2/3 w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <span className="flex aspect-2/3 w-full items-center justify-center text-muted-foreground">
              <FilmIcon className="size-7" aria-hidden="true" />
              <span className="sr-only">لا توجد صورة غلاف</span>
            </span>
          )}
        </Link>
        {top && (
          <div className="absolute inset-s-2 top-2 flex size-8 items-center justify-center rounded-md border bg-background/95">
            {top}
          </div>
        )}
        {status && (
          <Badge
            variant={status.featured ? "default" : "secondary"}
            className="absolute inset-e-2 top-2"
          >
            {status.featured && <StarIcon data-icon="inline-start" />}
            {status.label}
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/database/works/$workId"
            params={{ workId: member.titleId }}
            className="line-clamp-2 text-sm font-semibold leading-6 transition-colors group-hover:text-primary motion-reduce:transition-none"
          >
            {member.title}
          </Link>
          <WorkScoreBadge score={member.score} />
          {!status && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 border-t pt-3">{actions}</div>}
      </div>
    </article>
  );
}
function CatalogImages({
  kind,
  data,
  onEdit,
  onRemove,
  pending,
}: {
  kind: CatalogKind;
  data: CatalogDetail;
  onEdit: (
    title: string,
    table: string,
    row: DatabaseRow | null,
    defaults?: DatabaseRow,
    hidden?: string[],
  ) => void;
  onRemove: (row: DatabaseRow) => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy[kind].imageTitle}</CardTitle>
        <CardDescription>
          {kind === "planets"
            ? "صور الأعمال التابعة لهذا العالم. حرّر صور كل عمل من صفحته."
            : "صور مسجلة في المكتبة؛ إضافة رابط صورة لا ترفع ملفاً جديداً."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kind === "planets"
            ? data.members.map((member) => (
                <Link
                  key={member.titleId}
                  to="/database/works/$workId"
                  params={{ workId: member.titleId }}
                  className="flex flex-col gap-2"
                >
                  <ImagePreview kind="planets" path={member.image} title={member.title} />
                  <span className="text-sm">{member.title}</span>
                </Link>
              ))
            : data.images.map((image) => (
                <div key={text(image.row.id)} className="flex flex-col gap-3">
                  <ImagePreview kind={kind} path={image.path} title={name(data.row)} />
                  <Badge variant={image.row.is_primary === true ? "default" : "secondary"}>
                    {text(image.row.role)}
                    {image.row.is_primary === true ? " · رئيسية" : ""}
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onEdit(
                          "تحرير ربط الصورة",
                          "media_asset_assignments",
                          image.row,
                          { entity_id: data.row.id ?? null },
                          ["entity_id", "title_id", "installment_id", "episode_id"],
                        )
                      }
                    >
                      تحرير
                    </Button>
                    <UnlinkButton
                      label="ربط الصورة"
                      disabled={pending}
                      onConfirm={() => onRemove(image.row)}
                    />
                  </div>
                </div>
              ))}
        </div>
        {kind !== "planets" && !data.images.length && (
          <p className="text-sm text-muted-foreground">لم تُربط صورة بهذا السجل بعد.</p>
        )}
      </CardContent>
      {kind !== "planets" && (
        <CardFooter>
          <Button
            variant="outline"
            onClick={() =>
              onEdit(
                "ربط صورة من المكتبة",
                "media_asset_assignments",
                null,
                {
                  entity_id: data.row.id ?? null,
                  role: kind === "people" ? "profile" : "logo",
                  is_primary: false,
                },
                ["entity_id", "title_id", "installment_id", "episode_id"],
              )
            }
          >
            <PlusIcon data-icon="inline-start" />
            ربط صورة
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
