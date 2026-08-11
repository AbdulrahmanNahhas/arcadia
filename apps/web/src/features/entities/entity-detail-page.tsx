import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  BookOpenIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  FilmSlateIcon,
  GameControllerIcon,
  GridFourIcon,
  HeartIcon,
  ImagesIcon,
  RowsIcon,
  SparkleIcon,
  StarIcon,
  TelevisionSimpleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LibraryHeader } from "@/features/library/components/library-header";
import { kindLabels } from "@/features/library/filtering";
import type { Entity, WorkContribution, WorkKind } from "@/features/library/model";
import { statusLabelsAr } from "@/features/library/translations";
import { cn } from "@/lib/utils";
import { getEntities } from "@/server/library.functions";
import { contributionRoleLabels, entityMonogram, entityTypeLabels } from "./entity-labels";

type ViewMode = "poster" | "card" | "expanded";

// Shared with the timeline view — consider moving these three to a
// "@/features/library/work-visuals" module if you reuse them a third time.
const kindIcons = {
  movie: FilmSlateIcon,
  film: FilmSlateIcon,
  tv: TelevisionSimpleIcon,
  series: TelevisionSimpleIcon,
  show: TelevisionSimpleIcon,
  anime: SparkleIcon,
  novel: BookOpenIcon,
  book: BookOpenIcon,
  manga: BookOpenIcon,
  game: GameControllerIcon,
} as const;

const statusStyles: Record<string, string> = {
  watching: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  reading: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  in_progress: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ongoing: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  finished: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  dropped: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  on_hold: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  planned: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  plan_to_watch: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};
const defaultStatusStyle = "bg-slate-500/10 text-slate-600 dark:text-slate-400";

function ratingStyle(rating: number) {
  if (rating >= 8.5) return "text-emerald-600 dark:text-emerald-400";
  if (rating >= 7) return "text-amber-600 dark:text-amber-400";
  if (rating >= 5) return "text-orange-600 dark:text-orange-400";
  return "text-rose-600 dark:text-rose-400";
}

export function EntityDetailPage({ entityId }: { entityId: string }) {
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const entity = entities.find(({ id }) => id === entityId);
  const [role, setRole] = useState<WorkContribution["role"] | "all">("all");
  const [kind, setKind] = useState<WorkKind | "all">("all");
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  const works = useMemo(
    () =>
      entity?.works.filter(
        (work) =>
          (showHidden ||
            (work.status !== "saved" &&
              work.releaseStatus !== "announced" &&
              !work.isSequelMovie)) &&
          (role === "all" || work.roles.includes(role)) &&
          (kind === "all" || work.kind === kind),
      ) ?? [],
    [entity, kind, role, showHidden],
  );

  if (!entity) {
    return (
      <div className="min-h-screen bg-background">
        <LibraryHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold">لم يُعثر على هذا السجل</h1>
          <Link
            to="/entities"
            search={{}}
            className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
          >
            العودة إلى الدليل
          </Link>
        </main>
      </div>
    );
  }

  const EntityIcon = entity.entityType === "person" ? UsersThreeIcon : BuildingsIcon;

  return (
    <div className="min-h-screen bg-background">
      <LibraryHeader />
      <main className="mx-auto flex max-w-375 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/entities"
          search={{}}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}
        >
          <ArrowRightIcon data-icon="inline-start" />
          كل الأشخاص والجهات
        </Link>

        <section className="relative overflow-hidden rounded-3xl border bg-card">
          <div className="relative h-32 overflow-hidden border-b bg-linear-to-br from-primary/12 via-muted/40 to-transparent sm:h-40">
            <div
              className="absolute inset-0 text-foreground/50 opacity-[0.12]"
              style={{
                backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
          </div>
          <div className="grid gap-6 px-6 pb-7 sm:grid-cols-[11rem_minmax(0,1fr)] sm:px-8 lg:px-10">
            <div
              className="-mt-16 flex aspect-square w-32 items-center justify-center overflow-hidden rounded-[1.75rem] border-4 border-card bg-linear-to-br from-primary/15 to-primary/40 font-mono text-2xl font-semibold shadow-lg sm:-mt-20 sm:w-44"
              dir="ltr"
            >
              {entity.imagePath ? (
                <img
                  src={entity.imagePath}
                  alt={`${entity.name} logo`}
                  className="size-full bg-background object-contain p-4"
                />
              ) : (
                entityMonogram(entity.name) || (
                  <EntityIcon className="size-10 text-primary/60" weight="duotone" />
                )
              )}
            </div>
            <div className="min-w-0 sm:pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <EntityIcon className="size-3" weight="fill" />
                  {entityTypeLabels[entity.entityType]}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FilmSlateIcon className="size-3" weight="fill" />
                  {entity.workCount} عمل
                </Badge>
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl" dir="ltr">
                {entity.name}
              </h1>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
            <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">الأعمال</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {works.length} من {entity.workCount}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="entity-show-hidden"
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Switch
                      id="entity-show-hidden"
                      checked={showHidden}
                      onCheckedChange={setShowHidden}
                    />
                    إظهار المحفوظة والقادمة وأفلام التكملات
                  </label>
                  <ToggleGroup
                    value={[viewMode]}
                    onValueChange={(values) => {
                      const next = values.at(-1) as ViewMode | undefined;
                      if (next) setViewMode(next);
                    }}
                    variant="outline"
                    spacing={0}
                    size="sm"
                    aria-label="طريقة عرض الأعمال"
                  >
                    <ToggleGroupItem value="poster" aria-label="أفيشات فقط" title="أفيشات فقط">
                      <ImagesIcon />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="card" aria-label="بطاقات" title="بطاقات">
                      <GridFourIcon />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="expanded" aria-label="عرض موسّع" title="عرض موسّع">
                      <RowsIcon />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              <ToggleGroup
                value={[kind]}
                onValueChange={(values) => {
                  const next = values.at(-1) as WorkKind | "all" | undefined;
                  if (next) setKind(next);
                }}
                variant="outline"
                spacing={0}
                size="sm"
                aria-label="فلترة نوع العمل"
                className="max-w-full overflow-x-auto"
              >
                <ToggleGroupItem value="all">الكل</ToggleGroupItem>
                {entity.kinds.map(({ kind }) => (
                  <ToggleGroupItem key={kind} value={kind}>
                    {kindLabels[kind]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div
              className={cn(
                "grid gap-3",
                viewMode === "poster" &&
                  "grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
                viewMode === "card" && "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
                viewMode === "expanded" && "grid-cols-1 sm:grid-cols-2",
              )}
            >
              {works.map((work) => (
                <WorkTile key={work.id} work={work} mode={viewMode} />
              ))}
            </div>
          </div>

          <aside className="order-1 flex flex-col gap-4 lg:order-2">
            <Card>
              <CardHeader>
                <CardTitle>معلومات</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                {entity.establishedAt && (
                  <ProfileFact icon={CalendarBlankIcon} label="تأسس" value={entity.establishedAt} />
                )}
                {entity.birthDate && (
                  <ProfileFact icon={CalendarBlankIcon} label="الميلاد" value={entity.birthDate} />
                )}
                {entity.deathDate && (
                  <ProfileFact icon={CalendarBlankIcon} label="الوفاة" value={entity.deathDate} />
                )}
                {entity.favorites !== null && (
                  <ProfileFact
                    icon={HeartIcon}
                    label="المفضلة على MAL"
                    value={entity.favorites.toLocaleString("en")}
                  />
                )}
                <ProfileFact
                  icon={FilmSlateIcon}
                  label="الأعمال"
                  value={String(entity.workCount)}
                />
                {entity.primaryUrl && (
                  <a
                    href={entity.primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}
                  >
                    الرابط المرجعي
                    <ArrowSquareOutIcon data-icon="inline-end" />
                  </a>
                )}
                {entity.wikipediaUrl && (
                  <a
                    href={entity.wikipediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}
                  >
                    ويكيبيديا
                    <ArrowSquareOutIcon data-icon="inline-end" />
                  </a>
                )}
              </CardContent>
            </Card>

            {entity.description && (
              <Card>
                <CardHeader>
                  <CardTitle>نبذة</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground" dir="auto">
                    {entity.description}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>الأدوار</CardTitle>
                <CardDescription>اختر دوراً لعرض أعماله فقط.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <RoleButton
                  label="كل الأدوار"
                  count={entity.workCount}
                  total={entity.workCount}
                  pressed={role === "all"}
                  onClick={() => setRole("all")}
                />
                {entity.roles.map((item) => (
                  <RoleButton
                    key={item.role}
                    label={contributionRoleLabels[item.role]}
                    count={item.count}
                    total={entity.workCount}
                    pressed={role === item.role}
                    onClick={() => setRole(item.role)}
                  />
                ))}
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>
    </div>
  );
}

function WorkTile({ work, mode }: { work: Entity["works"][number]; mode: ViewMode }) {
  const KindIcon = kindIcons[work.kind as unknown as keyof typeof kindIcons] ?? FilmSlateIcon;

  if (mode === "poster") {
    return (
      <Link
        to="/titles/$titleId"
        params={{ titleId: work.id }}
        className="group relative block aspect-2/3 overflow-hidden rounded-xl border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {work.imagePath ? (
          <img
            src={work.imagePath}
            alt=""
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/15 to-primary/45">
            <KindIcon className="size-7 text-primary/50" weight="light" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 rounded-md bg-background/85 p-1 backdrop-blur-sm">
          <KindIcon className="size-3 text-foreground/70" weight="fill" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent p-2 pt-6 opacity-0 transition duration-200 group-hover:opacity-100">
          <p className="line-clamp-2 text-[11px] leading-4 font-medium text-white">
            {work.arabicTitle || work.title}
          </p>
        </div>
      </Link>
    );
  }

  if (mode === "expanded") {
    return (
      <Link
        to="/titles/$titleId"
        params={{ titleId: work.id }}
        className="group block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="flex h-full flex-row overflow-hidden p-0 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
          <div className="relative w-24 shrink-0 overflow-hidden bg-muted sm:w-28">
            {work.imagePath ? (
              <img
                src={work.imagePath}
                alt=""
                className="size-full object-cover transition duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/15 to-primary/45">
                <KindIcon className="size-6 text-primary/50" weight="light" />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
            <div>
              <CardTitle className="line-clamp-1 text-sm leading-5">
                {work.arabicTitle || work.title}
              </CardTitle>
              <CardDescription className="truncate" dir="ltr">
                {work.title}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <KindIcon className="size-3.5" weight="duotone" />
              {kindLabels[work.kind]}
              {work.year && <span>· {work.year}</span>}
              {work.calculatedRating !== null && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-medium",
                    ratingStyle(work.calculatedRating),
                  )}
                >
                  <StarIcon className="size-3" weight="fill" />
                  {work.calculatedRating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-1.5">
              {work.roles.map((workRole) => (
                <Badge key={workRole} variant="outline">
                  {contributionRoleLabels[workRole]}
                </Badge>
              ))}
              <span
                className={cn(
                  "ms-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
                  statusStyles[work.status as unknown as string] ?? defaultStatusStyle,
                )}
              >
                {statusLabelsAr[work.status]}
              </span>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      className="group min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full overflow-hidden pt-0 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="relative aspect-2/3 bg-muted">
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/15 to-primary/45">
              <KindIcon className="size-8 text-primary/50" weight="light" />
            </div>
          )}
          <div className="absolute top-2 left-2 rounded-md bg-background/85 p-1 backdrop-blur-sm">
            <KindIcon className="size-3 text-foreground/70" weight="fill" />
          </div>
        </div>
        <CardHeader>
          <CardTitle className="line-clamp-2 text-sm leading-5">
            {work.arabicTitle || work.title}
          </CardTitle>
          <CardDescription className="truncate" dir="ltr">
            {work.title}
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-auto flex flex-wrap gap-1.5">
          {work.roles.map((workRole) => (
            <Badge key={workRole} variant="outline">
              {contributionRoleLabels[workRole]}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </Link>
  );
}

function ProfileFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarBlankIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" weight="duotone" />
      </span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto font-medium" dir="auto">
        {value}
      </span>
    </div>
  );
}

function RoleButton({
  label,
  count,
  total,
  pressed,
  onClick,
}: {
  label: string;
  count: number;
  total: number;
  pressed: boolean;
  onClick: () => void;
}) {
  const fillPct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl px-3 py-2.5 text-sm transition hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background"
    >
      <span
        className="absolute inset-y-0 right-0 -z-10 bg-primary/10 transition-all group-aria-pressed:bg-background/15"
        style={{ width: `${fillPct}%` }}
      />
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums opacity-70">{count}</span>
      </span>
    </button>
  );
}
