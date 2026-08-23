import {
  ArrowRightIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  GitBranchIcon,
} from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useCurrentAccount } from "@/features/accounts/api";
import { getAdminEntities, getEntities } from "@/server/library.functions";
import { getStudioLineage } from "@/server/platform.functions";
import { EntityDialog } from "./components/entity-dialog";
import { PlatformShell } from "./components/platform-shell";

export function StudioPage({ studioId }: { studioId: string }) {
  const { data: accountData } = useCurrentAccount();
  const isAdmin = accountData?.account.role === "owner" || accountData?.account.role === "editor";
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  // Admins see private works too — the public /studios feed hard-excludes them, so this page
  // re-fetches from the admin-only entities endpoint once we know the viewer can see them.
  const { data: adminEntities } = useQuery({
    queryKey: ["entities", "admin"],
    queryFn: () => getAdminEntities(),
    enabled: isAdmin,
  });
  const { data: relationships } = useSuspenseQuery({
    queryKey: ["studio-lineage"],
    queryFn: () => getStudioLineage(),
  });
  const studio = (isAdmin && adminEntities ? adminEntities : entities).find(
    (entity) => entity.id === studioId && entity.entityType === "organization",
  );
  if (!studio)
    return (
      <PlatformShell>
        <div className="mx-auto max-w-3xl px-5 py-32">تعذر العثور على الاستوديو.</div>
      </PlatformShell>
    );
  const related = relationships.filter(
    (relationship) => relationship.source.id === studio.id || relationship.target.id === studio.id,
  );
  return (
    <PlatformShell>
      <section className="archive-grid border-b border-white/8">
        <div className="mx-auto grid max-w-400 gap-8 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[13rem_1fr] lg:items-center">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl">
            {studio.imagePath ? (
              <img src={studio.imagePath} alt="" className="size-full object-contain p-0" />
            ) : (
              <BuildingsIcon size={64} className="text-muted-foreground" />
            )}
          </div>
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRightIcon /> الرئيسية
            </Link>
            <p className="mt-8 text-xs font-semibold tracking-[0.16em] text-primary">سجل منظمة</p>
            <h1 className="mt-3 font-heading text-4xl leading-tight font-semibold sm:text-6xl">
              {studio.name}
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-9 text-foreground/75">
              {studio.description ||
                "لم يُكتب التاريخ التحريري لهذا الاستوديو بعد. يمكن إثراؤه دون حشر العلاقات التاريخية في الوصف."}
            </p>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-400 gap-12 px-5 pb-28 pt-12 sm:px-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-14">
          <section>
            <h2 className="font-heading text-2xl font-semibold">
              أعمال مرتبطة{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({studio.works.length})
              </span>
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {[...studio.works]
                .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
                .map((work) => (
                  <Link
                    key={work.id}
                    to="/titles/$titleId"
                    params={{ titleId: work.id }}
                    className="group"
                  >
                    <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-white/8">
                      {work.imagePath && (
                        <img
                          src={work.imagePath}
                          alt=""
                          className="size-full object-cover transition group-hover:scale-105"
                        />
                      )}
                      {work.isPrivate && (
                        <Badge variant="destructive" className="absolute top-1.5 inset-s-1.5">
                          خاص
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-2 truncate text-sm font-medium">
                      {work.arabicTitle || work.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{work.year ?? "—"}</p>
                  </Link>
                ))}
            </div>
          </section>
          {related.length > 0 && (
            <section>
              <h2 className="font-heading text-2xl font-semibold">التاريخ والسلالة</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                علاقات مطبّعة، وليست استنتاجات من نصوص الوصف.
              </p>

              <div className="mt-6 space-y-3">
                {related.map((relationship) => {
                  const other =
                    relationship.source.id === studio.id
                      ? relationship.target
                      : relationship.source;
                  return (
                    <div
                      key={relationship.id}
                      className="rounded-xl border border-white/8 bg-card/45 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <EntityDialog entity={other}>
                          <span className="font-heading font-semibold hover:text-primary">
                            {other.name}
                          </span>
                        </EntityDialog>
                        <Badge variant="outline">{relationship.type.nameAr}</Badge>
                        {relationship.occurredOn && (
                          <span className="text-xs text-muted-foreground">
                            {relationship.occurredOn}
                          </span>
                        )}
                      </div>
                      {relationship.description && (
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          {relationship.description}
                        </p>
                      )}
                      <div className="mt-3 flex -space-x-2 space-x-reverse">
                        {relationship.people.slice(0, 3).map(({ entity }) => (
                          <EntityDialog key={entity.id} entity={entity}>
                            <span className="flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-muted text-xs">
                              {entity.imagePath ? (
                                <img
                                  src={entity.imagePath}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                entity.name.slice(0, 1)
                              )}
                            </span>
                          </EntityDialog>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-white/8 bg-card/45 p-5">
            <h2 className="font-heading text-sm font-semibold">بيانات المنظمة</h2>
            <dl className="mt-4 space-y-4">
              <Meta
                icon={<CalendarBlankIcon />}
                label="التأسيس"
                value={studio.establishedAt || "غير موثّق"}
              />
              <Meta
                icon={<BuildingsIcon />}
                label="أعمال مرتبطة"
                value={String(studio.workCount)}
              />
              <Meta
                icon={<GitBranchIcon />}
                label="علاقات تاريخية"
                value={String(related.length)}
              />
            </dl>
          </div>
          <Link
            to="/lineage"
            className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/8 p-5 text-sm font-medium text-primary"
          >
            استكشف خريطة السلالة <ArrowRightIcon className="rotate-180" />
          </Link>
        </aside>
      </div>
    </PlatformShell>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="mt-0.5 text-muted-foreground">{icon}</dt>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-sm">{value}</dd>
      </div>
    </div>
  );
}
