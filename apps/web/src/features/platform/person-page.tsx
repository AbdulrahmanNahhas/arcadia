import { ArrowRightIcon, BriefcaseIcon, GitBranchIcon, UserIcon } from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { useCurrentAccount } from "@/features/accounts/api";
import { contributionRoleLabels } from "@/features/entities/entity-labels";
import { getAdminEntities, getEntities } from "@/server/library.functions";
import { getStudioLineage } from "@/server/platform.functions";
import { EntityDialog } from "./components/entity-dialog";
import { PlatformShell } from "./components/platform-shell";

export function PersonPage({ personId }: { personId: string }) {
  const { data: accountData } = useCurrentAccount();
  const isAdmin = accountData?.account.role === "owner" || accountData?.account.role === "editor";
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  // Admins see private works too — the public /people feed hard-excludes them, so this page
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
  const person = (isAdmin && adminEntities ? adminEntities : entities).find(
    (entity) => entity.id === personId && entity.entityType === "person",
  );

  if (!person)
    return (
      <PlatformShell>
        <div className="mx-auto max-w-3xl px-5 py-32">تعذر العثور على الشخص.</div>
      </PlatformShell>
    );

  const related = relationships.filter((relationship) =>
    relationship.people.some(({ entity }) => entity.id === person.id),
  );

  return (
    <PlatformShell>
      <section className="archive-grid border-b border-white/8">
        <div className="mx-auto grid max-w-400 gap-8 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[13rem_1fr] lg:items-center">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-full border border-white/10 bg-card shadow-2xl">
            {person.imagePath ? (
              <img src={person.imagePath} alt="" className="size-full object-cover" />
            ) : (
              <UserIcon size={64} className="text-muted-foreground" />
            )}
          </div>
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRightIcon /> الرئيسية
            </Link>
            <p className="mt-8 text-xs font-semibold tracking-[0.16em] text-primary">سجل شخص</p>
            <h1 className="mt-3 font-heading text-4xl leading-tight font-semibold sm:text-6xl">
              {person.name}
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-9 text-foreground/75">
              {person.description || "لم تُكتب السيرة التحريرية لهذا الشخص بعد."}
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
                ({person.works.length})
              </span>
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {person.works.map((work) => (
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
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span>{work.year ?? "—"}</span>
                    {work.roles.map((role) => (
                      <Badge key={role} variant="outline" className="px-1 py-0 text-[10px]">
                        {contributionRoleLabels[role]}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
          {related.length > 0 && (
            <section>
              <h2 className="font-heading text-2xl font-semibold">التاريخ والسلالة</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                العلاقات التي سُجِّل هذا الشخص مشاركاً فيها.
              </p>
              <div className="mt-6 space-y-3">
                {related.map((relationship) => {
                  const participation = relationship.people.find(
                    ({ entity }) => entity.id === person.id,
                  );
                  return (
                    <div
                      key={relationship.id}
                      className="rounded-xl border border-white/8 bg-card/45 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <EntityDialog entity={relationship.source}>
                          <span className="font-heading font-semibold hover:text-primary">
                            {relationship.source.name}
                          </span>
                        </EntityDialog>
                        <Badge variant="outline">{relationship.type.nameAr}</Badge>
                        <EntityDialog entity={relationship.target}>
                          <span className="font-heading font-semibold hover:text-primary">
                            {relationship.target.name}
                          </span>
                        </EntityDialog>
                        {relationship.occurredOn && (
                          <span className="text-xs text-muted-foreground">
                            {relationship.occurredOn}
                          </span>
                        )}
                      </div>
                      {participation && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          الدور: {participation.role}
                        </p>
                      )}
                      {relationship.description && (
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          {relationship.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-white/8 bg-card/45 p-5">
            <h2 className="font-heading text-sm font-semibold">بيانات الشخص</h2>
            <dl className="mt-4 space-y-4">
              <Meta
                icon={<BriefcaseIcon />}
                label="أعمال مرتبطة"
                value={String(person.workCount)}
              />
              <Meta icon={<UserIcon />} label="أدوار" value={String(person.roles.length)} />
              <Meta
                icon={<GitBranchIcon />}
                label="مشاركات تاريخية"
                value={String(related.length)}
              />
            </dl>
          </div>
          {person.roles.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-card/45 p-5">
              <h2 className="font-heading text-sm font-semibold">الأدوار</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {person.roles.map(({ role, count }) => (
                  <Badge key={role} variant="outline">
                    {contributionRoleLabels[role]} · {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
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
