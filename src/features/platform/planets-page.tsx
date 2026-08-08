import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getPlanets } from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";

export function PlanetsPage() {
  const { data: planets } = useSuspenseQuery({
    queryKey: ["planets"],
    queryFn: () => getPlanets(),
  });
  return (
    <PlatformShell>
      <div className="archive-grid border-b border-white/8">
        <header className="mx-auto max-w-400 px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">الأطلس الشخصي</p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-tight font-semibold sm:text-6xl">
            الكواكب ليست تصنيفات فقط؛ إنها طرق دخول إلى أرشيفك.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
            مرتبة الآن بحسب عدد الأعمال. تستطيع الإدارة تغيير تعريف كل كوكب أو إسناد أي عمل مؤهل
            يدوياً.
          </p>
        </header>
      </div>
      <div className="mx-auto grid max-w-400 gap-5 px-5 pb-28 pt-10 sm:px-8 md:grid-cols-2 xl:grid-cols-3">
        {planets.map((planet, index) => (
          <Link
            key={planet.id}
            to="/planets/$planetSlug"
            params={{ planetSlug: planet.slug }}
            className="group relative min-h-72 overflow-hidden rounded-2xl border border-white/10 bg-card p-6 transition hover:-translate-y-1 hover:border-white/20"
          >
            <div
              className="absolute -end-12 -top-12 size-44 rounded-full blur-3xl"
              style={{ background: `${planet.primaryColor}36` }}
            />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between">
                <span
                  className="flex size-14 items-center justify-center rounded-full border text-2xl"
                  style={{
                    borderColor: `${planet.primaryColor}88`,
                    background: `${planet.primaryColor}18`,
                  }}
                >
                  {planet.icon}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  مدار {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h2 className="mt-8 font-heading text-xl font-semibold">{planet.nameAr}</h2>
              <p className="mt-3 line-clamp-3 leading-7 text-muted-foreground">
                {planet.description}
              </p>
              <div className="mt-auto flex items-center pt-7 text-sm">
                <span>{planet.workCount} عمل</span>
                <span className="ms-auto flex items-center gap-1 text-primary">
                  استكشف <ArrowLeftIcon className="transition group-hover:-translate-x-1" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PlatformShell>
  );
}
