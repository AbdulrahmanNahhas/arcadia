import {
  BuildingsIcon,
  MagnifyingGlassIcon,
  SortAscendingIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LibraryHeader } from "@/features/library/components/library-header";
import type { Entity, WorkContribution } from "@/features/library/model";
import { contributorRoleEntityType } from "@/features/library/model";
import { getEntities } from "@/server/library.functions";
import { contributionRoleLabels, entityMonogram } from "./entity-labels";

export type EntityDirectorySearch = {
  q?: string;
  type?: Entity["entityType"] | "all";
  role?: WorkContribution["role"] | "all";
  sort?: "name" | "works";
};

function visibleWorkCount(entity: Entity) {
  return entity.works.filter(
    (work) => work.status !== "saved" && work.releaseStatus !== "upcoming" && !work.isSequelMovie,
  ).length;
}

export function EntitiesPage({
  search,
  onSearchChange,
}: {
  search: EntityDirectorySearch;
  onSearchChange: (search: EntityDirectorySearch) => void;
}) {
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const type = search.type ?? "all";
  const role = search.role ?? "all";
  const sort = search.sort ?? "works";
  const directoryPreset =
    type === "person"
      ? "person"
      : type === "organization" && role === "animation_studio"
        ? "studio"
        : type === "organization" && role === "publisher"
          ? "publisher"
          : type === "organization"
            ? "organization"
            : "all";
  const availableRoles = useMemo(
    () =>
      [...new Set(entities.flatMap((entity) => entity.roles.map(({ role }) => role)))]
        .sort((left, right) =>
          contributionRoleLabels[left].localeCompare(contributionRoleLabels[right], "ar"),
        )
        .filter((item) => type === "all" || contributorRoleEntityType(item) === type),
    [entities, type],
  );
  const filtered = useMemo(() => {
    const query = search.q?.trim().toLocaleLowerCase() ?? "";
    return entities
      .filter((entity) => type === "all" || entity.entityType === type)
      .filter((entity) => role === "all" || entity.roles.some((item) => item.role === role))
      .filter((entity) => {
        if (!query) return true;
        return [
          entity.name,
          entity.description,
          entity.primaryUrl ?? "",
          entity.wikipediaUrl ?? "",
          entity.imdbId ?? "",
          ...entity.roles.map(({ role }) => contributionRoleLabels[role]),
          ...entity.works.map(({ title, arabicTitle }) => [title, arabicTitle ?? ""].join(" ")),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      })
      .sort((left, right) =>
        sort === "works"
          ? visibleWorkCount(right) - visibleWorkCount(left) ||
            left.name.localeCompare(right.name, "en")
          : left.name.localeCompare(right.name, "en"),
      );
  }, [entities, role, search.q, sort, type]);

  const totals = useMemo(
    () => ({
      people: entities.filter(({ entityType }) => entityType === "person").length,
      organizations: entities.filter(({ entityType }) => entityType !== "person").length,
      connections: entities.reduce((sum, entity) => sum + visibleWorkCount(entity), 0),
    }),
    [entities],
  );

  return (
    <div className="min-h-screen bg-background">
      <LibraryHeader />
      <main className="mx-auto flex max-w-375 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 rounded-3xl border bg-card p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-9">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-medium text-muted-foreground">دليل صنّاع المكتبة</p>
            <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              الأشخاص والشركات خلف كل عمل.
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              تصفح الاستوديوهات وشركات الإنتاج والناشرين، أو انتقل إلى مؤلف ومصمم شخصيات ومخرج لترى
              أعماله وأدواره في مكان واحد. الأسماء محفوظة بالإنجليزية.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6 border-t pt-5 lg:border-t-0 lg:border-s lg:pt-0 lg:ps-8">
            <AtlasStat label="شخص" value={totals.people} />
            <AtlasStat label="جهة" value={totals.organizations} />
            <AtlasStat label="صلة بعمل" value={totals.connections} />
          </dl>
        </section>

        <section className="flex flex-col gap-4" aria-label="فلاتر الدليل">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <InputGroup className="h-11 flex-1">
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="entity-search"
                value={search.q ?? ""}
                onChange={(event) =>
                  onSearchChange({ ...search, q: event.target.value || undefined })
                }
                placeholder="ابحث باسم إنجليزي أو عنوان عمل…"
                aria-label="ابحث في الأسماء والأعمال"
              />
            </InputGroup>
            <Select
              items={[
                { value: "all", label: "كل الأدوار" },
                ...availableRoles.map((item) => ({
                  value: item,
                  label: contributionRoleLabels[item],
                })),
              ]}
              value={role}
              onValueChange={(value) => {
                const nextRole = (value ?? "all") as NonNullable<EntityDirectorySearch["role"]>;
                onSearchChange({
                  ...search,
                  role: nextRole,
                  type: nextRole === "all" ? type : contributorRoleEntityType(nextRole),
                });
              }}
            >
              <SelectTrigger className="h-11 min-w-44">
                <SelectValue>
                  {role === "all" ? "كل الأدوار" : contributionRoleLabels[role]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">كل الأدوار</SelectItem>
                  {availableRoles.map((item) => (
                    <SelectItem key={item} value={item}>
                      {contributionRoleLabels[item]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              items={[
                { value: "works", label: "الأكثر أعمالاً" },
                { value: "name", label: "الاسم A–Z" },
              ]}
              value={sort}
              onValueChange={(value) =>
                onSearchChange({
                  ...search,
                  sort: (value ?? "works") as EntityDirectorySearch["sort"],
                })
              }
            >
              <SelectTrigger className="h-11 min-w-40">
                <SortAscendingIcon />
                <SelectValue>{sort === "works" ? "الأكثر أعمالاً" : "الاسم A–Z"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="works">الأكثر أعمالاً</SelectItem>
                  <SelectItem value="name">الاسم A–Z</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto pb-1">
            <ToggleGroup
              value={[directoryPreset]}
              onValueChange={(values) => {
                const next = values.at(-1);
                if (!next) return;
                if (next === "studio") {
                  onSearchChange({ ...search, type: "organization", role: "animation_studio" });
                } else if (next === "publisher") {
                  onSearchChange({ ...search, type: "organization", role: "publisher" });
                } else {
                  onSearchChange({
                    ...search,
                    type: next as EntityDirectorySearch["type"],
                    role: "all",
                  });
                }
              }}
              variant="outline"
              spacing={0}
              aria-label="نوع الصانع"
            >
              <ToggleGroupItem value="all">الكل</ToggleGroupItem>
              <ToggleGroupItem value="person">أشخاص</ToggleGroupItem>
              <ToggleGroupItem value="studio">استوديوهات</ToggleGroupItem>
              <ToggleGroupItem value="publisher">ناشرون</ToggleGroupItem>
              <ToggleGroupItem value="organization">منظمات</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </section>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{filtered.length} نتيجة</p>
          {(type !== "all" || role !== "all" || search.q) && (
            <button
              type="button"
              className="text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => onSearchChange({})}
            >
              مسح الفلاتر
            </button>
          )}
        </div>

        {filtered.length ? (
          <section
            className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            aria-label="نتائج الدليل"
          >
            {filtered.map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </section>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MagnifyingGlassIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد نتائج مطابقة</EmptyTitle>
              <EmptyDescription>جرّب اسماً آخر أو امسح أحد فلاتر النوع والدور.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </div>
  );
}

function EntityCard({ entity }: { entity: Entity }) {
  const EntityIcon = entity.entityType === "person" ? UsersThreeIcon : BuildingsIcon;

  return (
    <Link
      to="/entities/$entityId"
      params={{ entityId: entity.id }}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="relative h-full overflow-hidden border-border/60 py-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-lg rounded-lg">
        <div className="flex items-center gap-4" dir="ltr">
          <div className="relative size-26 shrink-0 overflow-hidden rounded-none bg-background border-l">
            {entity.imagePath ? (
              <img
                src={entity.imagePath}
                alt={`${entity.name} logo`}
                className="size-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-br from-muted to-muted/50 font-mono text-sm font-semibold text-muted-foreground">
                {entityMonogram(entity.name) || <EntityIcon className="size-6" />}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-start text-base font-semibold">
              {entity.name}
            </CardTitle>
            <CardDescription className="mt-1 text-start text-xs flex gap-1">
              {entity.roles.slice(0, 3).map(({ role, count }) => (
                <Badge key={role} variant="outline">
                  {contributionRoleLabels[role]} · {count}
                </Badge>
              ))}
            </CardDescription>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function AtlasStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
