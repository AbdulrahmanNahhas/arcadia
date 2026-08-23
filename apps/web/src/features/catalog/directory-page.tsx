import {
  BuildingsIcon,
  FilmStripIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useCurrentAccount } from "@/features/accounts/api";
import { contributionRoleLabels, entityMonogram } from "@/features/entities/entity-labels";
import type { Entity, WorkContribution } from "@/features/library/model";
import { EntityDialog } from "@/features/platform/components/entity-dialog";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { cn } from "@/lib/utils";
import { getAdminEntities, getEntities } from "@/server/library.functions";

type Kind = "people" | "studios";
type SortMode = "prolific" | "alphabetical";

const kindCopy: Record<
  Kind,
  { title: string; description: string; noun: string; icon: typeof UserIcon; placeholder: string }
> = {
  people: {
    title: "الأشخاص",
    description: "المخرجون والكتّاب وصنّاع القصص، مع أعمالهم وأدوارهم المحفوظة.",
    noun: "شخص مسجّل",
    icon: UserIcon,
    placeholder: "ابحث بالاسم أو عمل مرتبط…",
  },
  studios: {
    title: "الاستوديوهات",
    description: "بيوت الإنتاج والتحريك والجهات التي صنعت عوالم أركاديا.",
    noun: "استوديو مسجّل",
    icon: BuildingsIcon,
    placeholder: "ابحث باسم الاستوديو أو عمل مرتبط…",
  },
};

export function DirectoryPage({ kind }: { kind: Kind }) {
  const { data: accountData } = useCurrentAccount();
  const isAdmin = accountData?.account.role === "owner" || accountData?.account.role === "editor";
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  // Admins see private works too — /api/v1/people and /api/v1/studios hard-exclude private titles
  // at the SQL level, so this re-fetches from the admin-only entities endpoint once we know the
  // viewer can see them, matching the convention on the person/studio detail pages.
  const { data: adminEntities } = useQuery({
    queryKey: ["entities", "admin"],
    queryFn: () => getAdminEntities(),
    enabled: isAdmin,
  });
  const source = isAdmin && adminEntities ? adminEntities : entities;

  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState<SortMode>("prolific");

  const wantedType = kind === "people" ? "person" : "organization";
  const pool = useMemo(
    () => source.filter((entity) => entity.entityType === wantedType),
    [source, wantedType],
  );

  const roleOptions = useMemo(() => {
    const counts = new Map<WorkContribution["role"], number>();
    for (const entity of pool)
      for (const { role: entityRole, count } of entity.roles)
        counts.set(entityRole, (counts.get(entityRole) ?? 0) + count);
    return [...counts.entries()].toSorted((a, b) => b[1] - a[1]).slice(0, 8);
  }, [pool]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return pool
      .filter((entity) => (role === "all" ? true : entity.roles.some((item) => item.role === role)))
      .filter((entity) =>
        needle
          ? [
              entity.name,
              entity.description,
              ...entity.works.flatMap((work) => [work.title, work.arabicTitle ?? ""]),
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(needle)
          : true,
      )
      .toSorted((a, b) =>
        sort === "alphabetical"
          ? a.name.localeCompare(b.name, "ar")
          : b.workCount - a.workCount || a.name.localeCompare(b.name, "ar"),
      );
  }, [pool, query, role, sort]);

  const isDefaultView = !query && role === "all";
  const totalWorks = useMemo(() => pool.reduce((sum, entity) => sum + entity.workCount, 0), [pool]);
  const privateWorks = useMemo(
    () =>
      isAdmin
        ? pool.reduce(
            (sum, entity) => sum + entity.works.filter((work) => work.isPrivate).length,
            0,
          )
        : 0,
    [pool, isAdmin],
  );

  const { title, description, noun, icon: KindIcon, placeholder } = kindCopy[kind];

  // A single shared dialog instance, opened with whichever entity was last clicked. Mounting one
  // Dialog per card (as many as the whole filtered grid) was the source of the lag — each one
  // sets up its own base-ui Dialog root/portal even while closed.
  const [dialogEntity, setDialogEntity] = useState<Entity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openEntity = (entity: Entity) => {
    setDialogEntity(entity);
    setDialogOpen(true);
  };

  return (
    <PlatformShell>
      <section className="archive-grid relative overflow-hidden border-b border-white/8">
        <div
          className="pointer-events-none absolute -top-32 -inset-e-24 size-125 rounded-full bg-primary/15 blur-[160px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-400 px-5 pb-12 pt-28 sm:px-8 sm:pt-36">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary">
                دليل صنّاع المكتبة
              </p>
              <h1 className="mt-3 font-heading text-4xl font-semibold sm:text-6xl">{title}</h1>
              <p className="mt-4 max-w-2xl text-lg leading-9 text-foreground/70">{description}</p>
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-card/50 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <Stat icon={<KindIcon weight="duotone" />} value={pool.length} label={noun} />
              <div className="h-10 w-px bg-white/10" />
              <Stat
                icon={<FilmStripIcon weight="duotone" />}
                value={totalWorks}
                label="عمل مرتبط"
              />
              {isAdmin && privateWorks > 0 ? (
                <>
                  <div className="h-10 w-px bg-white/10" />
                  <Stat
                    icon={<SparkleIcon weight="duotone" />}
                    value={privateWorks}
                    label="عمل خاص"
                    tone="warn"
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-400 px-5 pb-28 pt-10 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <InputGroup className="h-11 max-w-md bg-muted/30">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
          </InputGroup>
          <SortToggle sort={sort} onChange={setSort} />
        </div>

        {roleOptions.length > 1 ? (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            <RoleChip active={role === "all"} onClick={() => setRole("all")}>
              الكل
            </RoleChip>
            {roleOptions.map(([optionRole, count]) => (
              <RoleChip
                key={optionRole}
                active={role === optionRole}
                onClick={() => setRole(optionRole)}
              >
                {contributionRoleLabels[optionRole]} <span className="opacity-60">· {count}</span>
              </RoleChip>
            ))}
          </div>
        ) : null}

        <section className="mt-10">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-heading text-xl font-semibold">
              {isDefaultView ? "كل السجلات" : "نتائج البحث"}
            </h2>
            <p className="text-sm text-muted-foreground">{filtered.length} سجل</p>
          </div>
          {filtered.length ? (
            <div className="grid gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((entity) => (
                <EntityCard key={entity.id} entity={entity} onSelect={openEntity} />
              ))}
            </div>
          ) : (
            <Empty className="min-h-72 border border-dashed border-white/10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MagnifyingGlassIcon />
                </EmptyMedia>
                <EmptyTitle>لا توجد نتائج مطابقة</EmptyTitle>
                <EmptyDescription>جرّب اسماً أو عنوان عمل آخر، أو امسح المرشحات.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </main>

      {dialogEntity ? (
        <EntityDialog entity={dialogEntity} open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : null}
    </PlatformShell>
  );
}

function Stat({
  icon,
  value,
  label,
  tone = "default",
}: {
  icon: ReactNode;
  value: number;
  label: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-xl ring-1",
          tone === "warn"
            ? "bg-amber-500/15 text-amber-300 ring-amber-500/25"
            : "bg-primary/15 text-primary ring-primary/25",
        )}
      >
        {icon}
      </div>
      <div>
        <div className="font-mono text-lg font-bold leading-none">{value}</div>
        <div className="mt-1 text-[10px] whitespace-nowrap text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function SortToggle({ sort, onChange }: { sort: SortMode; onChange: (sort: SortMode) => void }) {
  return (
    <div className="inline-flex items-center gap-1 self-start rounded-full border border-white/10 bg-muted/20 p-1">
      <Button
        type="button"
        size="sm"
        variant={sort === "prolific" ? "secondary" : "ghost"}
        className="rounded-full"
        onClick={() => onChange("prolific")}
      >
        الأكثر حضوراً
      </Button>
      <Button
        type="button"
        size="sm"
        variant={sort === "alphabetical" ? "secondary" : "ghost"}
        className="rounded-full"
        onClick={() => onChange("alphabetical")}
      >
        أبجدياً
      </Button>
    </div>
  );
}

function RoleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EntityCard({ entity, onSelect }: { entity: Entity; onSelect: (entity: Entity) => void }) {
  const isPerson = entity.entityType === "person";
  const Icon = isPerson ? UserIcon : BuildingsIcon;
  const topRole = entity.roles[0];
  return (
    <button
      type="button"
      onClick={() => onSelect(entity)}
      className="group flex w-full flex-col items-center gap-3 rounded-2xl p-2 text-center outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden bg-white ring-1 ring-white/10 transition duration-300 group-hover:shadow-lg group-hover:shadow-primary/10 group-hover:ring-primary/50",
          isPerson ? "rounded-full" : "rounded-2xl",
        )}
      >
        {entity.imagePath ? (
          <img
            src={entity.imagePath}
            alt=""
            loading="lazy"
            className={cn(
              "size-full bg-white transition duration-500 scale-95 group-hover:scale-101 rounded-2xl",
              isPerson ? "object-cover rounded-full" : "object-contain p-0",
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/20 to-muted text-2xl font-semibold text-muted-foreground">
            {entityMonogram(entity.name) || <Icon size={28} />}
          </div>
        )}
      </div>
      <div className="min-w-0 w-full">
        <h2 className="truncate font-heading text-sm font-semibold group-hover:text-primary">
          {entity.name}
        </h2>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {entity.workCount} {entity.workCount === 1 ? "عمل" : "أعمال"}
          {topRole ? ` · ${contributionRoleLabels[topRole.role]}` : ""}
        </p>
      </div>
    </button>
  );
}
