import type { ReleaseEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Layers, List, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Choice } from "../../components/choice";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { gateway, type ReleasesQuery } from "../../lib/bridge";
import { replaceParams, workLink } from "../shell/navigation";
import { episodeNumberLabel } from "../work/format";

const months = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const seasons = ["الشتاء", "الربيع", "الصيف", "الخريف"];
const views = [
  { value: "calendar", label: "التقويم", icon: CalendarDays },
  { value: "timeline", label: "الخط الزمني", icon: List },
  { value: "seasons", label: "الفصول", icon: Layers },
  { value: "upcoming", label: "القادم", icon: Sparkles },
];
const dateFormat = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
function dateLabel(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00Z`));
}
function numberParam(params: URLSearchParams, key: string, fallback: number, max: number) {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
}
function releaseTitle(item: ReleaseEntry) {
  return item.kind === "episode"
    ? `الحلقة ${episodeNumberLabel(item.episodeNumber ?? "")}${item.title ? ` · ${item.title}` : ""}`
    : item.title || (item.installmentKind === "movie" ? "فيلم" : "جزء جديد");
}
function ReleaseRow({ item, asOf }: { item: ReleaseEntry; asOf: string }) {
  const navigation = useCardNavigation();
  const href =
    workLink(item.workId, item.installmentId) +
    (item.kind === "episode" ? `&episode=${item.id}` : "");
  return (
    <a
      href={href}
      ref={navigation?.ref}
      onKeyDown={navigation?.onKeyDown}
      data-card-navigation=""
      className="release-row"
    >
      <Artwork id={item.poster?.id} alt="" className="release-poster" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-1.5 truncate">
          {item.workTitleAr || item.workTitle}
        </p>
        <h3 className="font-semibold text-sm leading-relaxed">{releaseTitle(item)}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {item.kind === "episode" && item.installmentTitle && <span>{item.installmentTitle}</span>}
          {item.runtimeMinutes != null && <span>{item.runtimeMinutes} دقيقة</span>}
          {item.episodeCount != null && item.episodeCount > 0 && (
            <span>{item.episodeCount} حلقة</span>
          )}
          <span>
            {item.kind === "episode" ? "حلقة" : item.installmentKind === "movie" ? "فيلم" : "جزء"}
          </span>
        </div>
      </div>
      {item.releaseDate && item.releaseDate >= asOf && (
        <Badge variant="secondary">{item.releaseDate === asOf ? "اليوم" : "قادم"}</Badge>
      )}
      <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </a>
  );
}
function useReleaseFeed(query: ReleasesQuery) {
  return useInfiniteQuery({
    queryKey: ["releases", "feed", query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.releases({ ...query, page: pageParam, pageSize: 24 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    staleTime: 60000,
  });
}
function ReleaseFeed({
  query,
  empty = "لا توجد إصدارات مسجّلة في هذه الفترة.",
  grouped = true,
}: {
  query: ReleasesQuery;
  empty?: string;
  grouped?: boolean;
}) {
  const feed = useReleaseFeed(query);
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const first = feed.data?.pages[0];
  const groups = new Map<string, ReleaseEntry[]>();
  for (const item of items) {
    const key = grouped ? (item.releaseDate ?? "undated") : "all";
    const entries = groups.get(key);
    if (entries) entries.push(item);
    else groups.set(key, [item]);
  }
  return (
    <div className="flex min-w-0 flex-col gap-5" aria-busy={feed.isFetching}>
      {feed.isLoading && (
        <p role="status" className="py-8 text-sm text-muted-foreground">
          جارٍ تحميل الإصدارات…
        </p>
      )}
      {feed.error && <Failure error={feed.error} retry={() => void feed.refetch()} />}
      {first && !items.length && <NoResults title="لا توجد إصدارات" description={empty} />}
      {[...groups].map(([date, entries]) => (
        <section key={date} className={cn("min-w-0", grouped && "release-date-group")}>
          {grouped && (
            <h3 className="release-date-label">
              {date === "undated" ? "لم يُعلن الموعد" : dateLabel(date)}
            </h3>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            {entries.map((item) => (
              <ReleaseRow key={item.id} item={item} asOf={first?.asOf ?? ""} />
            ))}
          </div>
        </section>
      ))}
      {first && first.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span role="status">
            {items.length} من {first.total} إصدار
          </span>
          {feed.hasNextPage && (
            <Button
              variant="outline"
              disabled={feed.isFetchingNextPage}
              onClick={() => void feed.fetchNextPage()}
            >
              {feed.isFetchingNextPage ? "جارٍ التحميل…" : "عرض المزيد"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
function CalendarView({
  year,
  month,
  kind,
  onMonth,
}: {
  year: number;
  month: number;
  kind: ReleasesQuery["kind"];
  onMonth: (month: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const overview = useQuery({
    queryKey: ["releases", "calendar", year, month, kind],
    queryFn: ({ signal }) => gateway.releases({ year, month, kind, pageSize: 1 }, signal),
    staleTime: 60000,
  });
  const first = new Date(0);
  first.setUTCFullYear(year, month - 1, 1);
  const last = new Date(0);
  last.setUTCFullYear(year, month, 0);
  const offset = first.getUTCDay();
  const days = last.getUTCDate();
  const counts = new Map(overview.data?.days.map((day) => [Number(day.date.slice(8)), day.count]));
  const today = overview.data?.asOf;
  const selectedQuery: ReleasesQuery = { year, month, kind };
  if (selected !== null) selectedQuery.day = selected;
  const selectedDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(selected ?? 1).padStart(2, "0")}`;
  return (
    <div className="release-calendar-layout">
      <section className="release-calendar" aria-label="تقويم الشهر">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label="الشهر السابق"
            disabled={month === 1}
            onClick={() => onMonth(month - 1)}
          >
            <ArrowRight data-icon="inline-start" />
          </Button>
          <div className="text-center">
            <h2 className="text-xl font-semibold">{months[month - 1]}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.data ? `${overview.data.total} إصدار مسجّل` : "جارٍ تحميل المواعيد…"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="الشهر التالي"
            disabled={month === 12}
            onClick={() => onMonth(month + 1)}
          >
            <ArrowLeft data-icon="inline-start" />
          </Button>
        </div>
        {overview.error && <Failure error={overview.error} retry={() => void overview.refetch()} />}
        <div
          className="grid grid-cols-7 gap-1 mb-2 text-center text-xs text-muted-foreground"
          aria-hidden="true"
        >
          {["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"].map((day) => (
            <span key={day} className="py-2">
              {day}
            </span>
          ))}
        </div>
        <div
          ref={grid}
          className="release-days"
          aria-busy={overview.isFetching}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const movement = new Map([
              ["ArrowLeft", 1],
              ["ArrowRight", -1],
              ["ArrowDown", 7],
              ["ArrowUp", -7],
            ]);
            const delta = movement.get(event.key);
            if (delta === undefined || !(event.target instanceof HTMLButtonElement)) return;
            event.preventDefault();
            const day = Number(event.target.dataset.day);
            grid.current
              ?.querySelector<HTMLButtonElement>(
                `[data-day="${Math.max(1, Math.min(days, day + delta))}"]`,
              )
              ?.focus();
          }}
        >
          {Array.from({ length: offset }, (_, index) => (
            <span key={`space-${index}`} aria-hidden="true" />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const day = index + 1;
            const count = counts.get(day) ?? 0;
            const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            return (
              <button
                key={day}
                type="button"
                data-day={day}
                className="release-day"
                aria-pressed={selected === day}
                aria-current={today === date ? "date" : undefined}
                aria-label={`${dateLabel(date)}${overview.data ? `، ${count} إصدار` : "، جارٍ تحميل المواعيد"}`}
                onClick={() => setSelected(day)}
              >
                <span className="release-day-number">{day}</span>
                {count > 0 && (
                  <>
                    <span className="release-day-count">
                      {count}
                      <span className="release-day-word"> إصدار</span>
                    </span>
                    <span className="release-day-dot" aria-hidden="true" />
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          اختر يومًا لعرض أجزائه وحلقاته. التواريخ من مكتبتك، وليست جدول بث مباشر.
        </p>
      </section>
      <aside className="min-w-0" aria-label="إصدارات الفترة المحددة">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="font-semibold">{selected ? dateLabel(selectedDate) : "إصدارات الشهر"}</h2>
          {selected && (
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              الشهر كاملًا
            </Button>
          )}
        </div>
        <ReleaseFeed query={selectedQuery} grouped={!selected} />
      </aside>
    </div>
  );
}
export function ReleasesPage({ params }: { params: URLSearchParams }) {
  const [now] = useState(() => new Date());
  const year = numberParam(params, "year", now.getFullYear(), 9999);
  const month = numberParam(params, "month", now.getMonth() + 1, 12);
  const season = numberParam(params, "season", Math.ceil(month / 3), 4);
  const view = views.find((item) => item.value === params.get("view"))?.value ?? "calendar";
  const kind: ReleasesQuery["kind"] =
    params.get("kind") === "episodes"
      ? "episodes"
      : params.get("kind") === "installments"
        ? "installments"
        : "all";
  const metadata = useQuery({
    queryKey: ["releases", "years"],
    queryFn: ({ signal }) => gateway.releases({ pageSize: 1 }, signal),
    staleTime: 60000,
  });
  const years = [...new Set([year, now.getFullYear(), ...(metadata.data?.years ?? [])])].toSorted(
    (a, b) => b - a,
  );
  const timelineQuery: ReleasesQuery = { year, kind };
  if (params.has("timelineMonth") && params.get("timelineMonth") !== "all")
    timelineQuery.month = numberParam(params, "timelineMonth", month, 12);
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    replaceParams("/releases", next);
  };
  return (
    <article className="releases-page" aria-label="الإصدارات">
      <header className="release-header">
        <div>
          <p className="release-eyebrow">
            <CalendarDays className="size-4" aria-hidden="true" /> مواعيد من مكتبتك
          </p>
          <h1>الإصدارات</h1>
          <p className="release-intro">عام من الحكايات. الأجزاء والحلقات، في موعدها.</p>
        </div>
        {view !== "upcoming" && (
          <div className="release-year">
            <Button
              variant="ghost"
              size="icon"
              aria-label="السنة السابقة"
              disabled={year <= 1}
              onClick={() => update({ year: String(year - 1) })}
            >
              <ArrowRight data-icon="inline-start" />
            </Button>
            <span aria-hidden="true" className="release-year-number">
              {year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="السنة التالية"
              disabled={year >= 9999}
              onClick={() => update({ year: String(year + 1) })}
            >
              <ArrowLeft data-icon="inline-start" />
            </Button>
          </div>
        )}
      </header>
      <div className="release-toolbar">
        <nav className="release-views" aria-label="طرق عرض الإصدارات">
          {views.map(({ value, label, icon: Icon }) => {
            const next = new URLSearchParams(params);
            next.set("view", value);
            return (
              <a
                key={value}
                href={`#/releases?${next}`}
                aria-current={view === value ? "page" : undefined}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
        <div className="flex flex-wrap gap-2 min-w-0">
          {view !== "upcoming" && (
            <Choice
              label="سنة الإصدار"
              value={String(year)}
              options={years.map((value) => ({ value: String(value), label: String(value) }))}
              onChange={(value) => update({ year: value })}
            />
          )}
          <Choice
            label="نوع الإصدار"
            value={kind}
            options={[
              { value: "all", label: "الأجزاء والحلقات" },
              { value: "installments", label: "الأجزاء فقط" },
              { value: "episodes", label: "الحلقات فقط" },
            ]}
            onChange={(value) => update({ kind: value })}
          />
        </div>
      </div>
      {view === "calendar" && (
        <>
          <div className="release-months" aria-label="أشهر السنة">
            {months.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-pressed={month === index + 1}
                onClick={() => update({ month: String(index + 1) })}
              >
                {label}
              </button>
            ))}
          </div>
          <CalendarView
            key={`${year}-${month}`}
            year={year}
            month={month}
            kind={kind}
            onMonth={(value) => update({ month: String(value) })}
          />
        </>
      )}
      {view === "timeline" && (
        <section className="release-timeline" aria-label="الخط الزمني">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">على امتداد {year}</h2>
            <div className="w-48">
              <Choice
                label="شهر الخط الزمني"
                value={params.get("timelineMonth") ?? "all"}
                options={[
                  { value: "all", label: "السنة كاملة" },
                  ...months.map((label, index) => ({ label, value: String(index + 1) })),
                ]}
                onChange={(value) => update({ timelineMonth: value })}
              />
            </div>
          </div>
          <ReleaseFeed query={timelineQuery} />
        </section>
      )}
      {view === "seasons" && (
        <section aria-label="الإصدارات حسب الفصل">
          <div className="release-season-tabs">
            {seasons.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-pressed={season === index + 1}
                onClick={() => update({ season: String(index + 1) })}
              >
                <span>{label}</span>
                <small>
                  {months[index * 3]} — {months[index * 3 + 2]}
                </small>
              </button>
            ))}
          </div>
          <p className="mb-6 text-xs text-muted-foreground">
            تقسيم السنة إلى فصول تقويمية؛ لا يغيّر ترتيب المواسم داخل العمل.
          </p>
          <div className="release-season-grid">
            {Array.from({ length: 3 }, (_, index) => (season - 1) * 3 + index + 1).map((value) => (
              <section key={value} className="min-w-0">
                <h2 className="release-season-month">
                  {months[value - 1]} <span>{year}</span>
                </h2>
                <ReleaseFeed query={{ year, month: value, kind }} />
              </section>
            ))}
          </div>
        </section>
      )}
      {view === "upcoming" && (
        <div className="release-upcoming-grid">
          <section className="min-w-0">
            <h2 className="release-section-heading">
              <Sparkles className="size-5" aria-hidden="true" />
              في الأفق
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              من اليوم فصاعدًا، عبر جميع السنوات. الموعد لا يعني توفّر المشاهدة.
            </p>
            <ReleaseFeed
              query={{ scope: "upcoming", kind }}
              empty="لا توجد مواعيد قادمة مسجّلة. يمكنك الاطلاع على الإصدارات التي لم يُعلن موعدها."
            />
          </section>
          <section className="release-undated">
            <h2 className="release-section-heading">
              <Clock3 className="size-5" aria-hidden="true" />
              بانتظار الموعد
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              أجزاء معلنة وحلقات لأجزاء معلنة أو جارية، دون تاريخ مسجّل.
            </p>
            <ReleaseFeed
              query={{ scope: "undated", kind }}
              grouped={false}
              empty="لا توجد إصدارات منتظرة دون موعد في المكتبة."
            />
          </section>
        </div>
      )}
      <footer className="release-footer">
        يعرض الأعمال العامة في مكتبتك فقط. لا تُستنتج مواعيد الحلقات من تاريخ الجزء.
      </footer>
    </article>
  );
}
