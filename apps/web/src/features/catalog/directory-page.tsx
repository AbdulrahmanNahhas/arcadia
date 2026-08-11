import { BuildingsIcon, MagnifyingGlassIcon, UserIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { contributionRoleLabels, entityMonogram } from "@/features/entities/entity-labels";
import type { Entity } from "@/features/library/model";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getEntities } from "@/server/library.functions";

type Kind = "people" | "studios";

export function DirectoryPage({ kind }: { kind: Kind }) {
  const { data } = useSuspenseQuery({ queryKey: ["entities"], queryFn: () => getEntities() });
  const [query, setQuery] = useState("");
  const wantedType = kind === "people" ? "person" : "organization";
  const entities = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return data
      .filter((entity) => entity.entityType === wantedType)
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
      .sort((a, b) => b.workCount - a.workCount || a.name.localeCompare(b.name));
  }, [data, query, wantedType]);
  const title = kind === "people" ? "الأشخاص" : "الاستوديوهات";
  const description =
    kind === "people"
      ? "المخرجون والكتّاب وصنّاع القصص، مع أعمالهم وأدوارهم المحفوظة."
      : "بيوت الإنتاج والتحريك والجهات التي صنعت عوالم أركاديا.";

  return (
    <PlatformShell>
      <section className="archive-grid border-b border-white/8">
        <div className="mx-auto max-w-400 px-5 pb-12 pt-28 sm:px-8 sm:pt-36">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">دليل صنّاع المكتبة</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold sm:text-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-9 text-foreground/70">{description}</p>
        </div>
      </section>
      <main className="mx-auto max-w-400 px-5 pb-28 pt-8 sm:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <InputGroup className="h-11 max-w-xl bg-muted/30">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`ابحث في ${title} أو الأعمال المرتبطة…`}
            />
          </InputGroup>
          <p className="text-sm text-muted-foreground">{entities.length} سجل</p>
        </div>
        {entities.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entities.map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </section>
        ) : (
          <Empty className="min-h-72 border border-dashed border-white/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MagnifyingGlassIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد نتائج مطابقة</EmptyTitle>
              <EmptyDescription>جرّب اسماً أو عنوان عمل آخر.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </PlatformShell>
  );
}

function EntityCard({ entity }: { entity: Entity }) {
  const Icon = entity.entityType === "person" ? UserIcon : BuildingsIcon;
  const to = entity.entityType === "person" ? "/people/$personId" : "/studios/$studioId";
  const params = entity.entityType === "person" ? { personId: entity.id } : { studioId: entity.id };
  return (
    <Link
      to={to}
      params={params as never}
      className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full overflow-hidden rounded-2xl border-white/8 py-0 transition duration-300 group-hover:-translate-y-1 group-hover:border-primary/35 group-hover:shadow-xl">
        <div className="flex items-center gap-4" dir="ltr">
          <div className="size-28 shrink-0 overflow-hidden border-e border-white/8 bg-muted">
            {entity.imagePath ? (
              <img
                src={entity.imagePath}
                alt=""
                className={`size-full ${entity.entityType === "person" ? "object-cover" : "object-contain p-2"}`}
                loading="lazy"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/20 to-muted text-xl text-muted-foreground">
                {entityMonogram(entity.name) || <Icon />}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 py-4 pe-4 text-start" dir="rtl">
            <h2 className="truncate font-heading text-base font-semibold">{entity.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{entity.workCount} أعمال مرتبطة</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {entity.roles.slice(0, 2).map(({ role, count }) => (
                <Badge key={role} variant="outline" className="text-[10px]">
                  {contributionRoleLabels[role]} · {count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
