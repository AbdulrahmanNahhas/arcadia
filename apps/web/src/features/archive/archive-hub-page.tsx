import {
  BellIcon,
  BooksIcon,
  CalendarDotsIcon,
  ClockCounterClockwiseIcon,
  HouseLineIcon,
  type Icon,
  UsersThreeIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useCurrentAccount } from "@/features/accounts/api";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { cn } from "@/lib/utils";
import {
  archiveKeys,
  getCalendar,
  getLibrary,
  getNotifications,
  getRecommendations,
  getWatchStats,
} from "./api";
import { FamilyPanel } from "./archive-family-panel";
import { HistoryPanel } from "./archive-history-panel";
import { NotificationsPanel } from "./archive-notifications-panel";
import { ArchiveOverview } from "./archive-overview";
import { isLibrarySort, LibraryPanel } from "./components/library-panel";
import { sessionStartedAt } from "./components/shared";
import { CalendarPanel } from "./components/upcoming";

type ArchiveTab = "overview" | "library" | "history" | "calendar" | "family" | "notifications";

/**
 * The section index. `hint` is the one-line annotation shown beside each entry on wide screens —
 * this rail is the page's table of contents, so every entry says what lives behind it rather
 * than relying on the label alone.
 */
const sections = [
  { value: "overview", label: "الموجز", hint: "ما ينتظرك الآن", icon: HouseLineIcon },
  { value: "library", label: "مكتبتي", hint: "المحفوظ والمقيَّم", icon: BooksIcon },
  {
    value: "history",
    label: "السجل",
    hint: "ما شاهدته وتصفّحته",
    icon: ClockCounterClockwiseIcon,
  },
  { value: "calendar", label: "التقويم", hint: "إصدارات مؤرَّخة", icon: CalendarDotsIcon },
  { value: "family", label: "العائلة", hint: "توصيات ونشاط وأمسيات", icon: UsersThreeIcon },
  { value: "notifications", label: "التنبيهات", hint: "ردود وتحديثات", icon: BellIcon },
] as const satisfies readonly { value: ArchiveTab; label: string; hint: string; icon: Icon }[];

const dateLineFormat = new Intl.DateTimeFormat("ar", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function greetingForHour(hour: number) {
  if (hour >= 4 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "طاب يومك";
  if (hour >= 17 && hour < 22) return "مساء الخير";
  return "ليلة هادئة";
}

/** Arabic counted nouns need three shapes, not two: singular, dual, then the plural that takes a
 *  leading numeral. Only the plural form renders a digit, so `2` reads «إصداران» and never «2 إصدارات». */
function CountedNoun({
  count,
  forms,
}: {
  count: number;
  forms: readonly [singular: string, dual: string, plural: string];
}) {
  if (count === 1) return <>{forms[0]}</>;
  if (count === 2) return <>{forms[1]}</>;
  return (
    <>
      <span className="font-mono font-semibold tabular-nums text-foreground">{count}</span>{" "}
      {forms[2]}
    </>
  );
}

/** Joins the pending-work clauses into one Arabic sentence: «أ، ب، وج.» */
function StatusSentence({ clauses }: { clauses: readonly { key: string; node: ReactNode }[] }) {
  if (clauses.length === 0) {
    return <>مساحتك مرتّبة — لا شيء ينتظر ردّك اليوم.</>;
  }
  return (
    <>
      {clauses.map((clause, index) => (
        <Fragment key={clause.key}>
          {index === 0 ? null : index === clauses.length - 1 ? "، و" : "، "}
          {clause.node}
        </Fragment>
      ))}
      .
    </>
  );
}

/**
 * The counts behind both the status sentence and the index rail. Every query here is one the
 * panels already own, keyed identically — opening the hub warms them, and no panel refetches.
 */
function useArchivePulse() {
  const stats = useQuery({ queryKey: archiveKeys.watchStats, queryFn: getWatchStats });
  const calendar = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar });
  const notifications = useQuery({
    queryKey: archiveKeys.notifications,
    queryFn: getNotifications,
  });
  const library = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary });
  const recommendations = useQuery({
    queryKey: archiveKeys.recommendations,
    queryFn: getRecommendations,
  });
  return {
    loading:
      stats.isPending || calendar.isPending || notifications.isPending || recommendations.isPending,
    unfinished: stats.data?.inProgressCount ?? 0,
    librarySize: library.data?.length ?? 0,
    upcoming: (calendar.data ?? []).filter(
      (item) => new Date(item.releaseDate).getTime() >= sessionStartedAt,
    ).length,
    unread: (notifications.data ?? []).filter((item) => item.readAt === null).length,
    awaitingReply: (recommendations.data ?? []).filter((item) => item.status === "pending").length,
  };
}

/**
 * One entry in the section index. A plain `Link` that rewrites `?tab=` — no custom focus-driven
 * selection here; the site's automatic spatial-nav scanner already treats every `a[href]` as a
 * focusable target on its own; layering a second, competing "focus selects the tab" mechanism on
 * top of that caused focus to bounce between adjacent entries (`?tab=` flipping back and forth on
 * its own). A real link is also simply the correct affordance for something that navigates.
 */
function ArchiveSectionLink({
  value,
  active,
  label,
  hint,
  icon: SectionIcon,
  count,
  countLabel,
  attention,
}: {
  value: ArchiveTab;
  active: boolean;
  label: string;
  hint: string;
  icon: Icon;
  count: number;
  countLabel: string;
  attention: boolean;
}) {
  return (
    <Link
      to="/archive"
      search={(previous) => ({ ...previous, tab: value })}
      replace
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/section relative flex flex-none items-center gap-2.5 rounded-xl px-3.5 py-2 text-start transition-colors",
        "text-foreground/65 hover:bg-muted/60 hover:text-foreground",
        active && "bg-foreground text-background! hover:bg-foreground/80",
      )}
    >
      <span aria-hidden className={cn(active && "opacity-100")} />
      <SectionIcon
        weight={attention ? "fill" : "regular"}
        className={cn(
          "shrink-0 transition-colors size-6",
          active ? "text-background" : "text-muted-foreground group-hover/section:text-foreground",
        )}
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-sm font-medium leading-5">{label}</span>
        <span className="hidden text-[0.6875rem] leading-4 text-muted-foreground lg:block">
          {hint}
        </span>
      </span>
      {count > 0 ? (
        <span
          className={cn(
            "ms-auto rounded-full px-1.5 py-0.5 font-mono text-[0.6875rem] leading-4 tabular-nums",
            attention ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {count}
          <span className="sr-only"> {countLabel}</span>
        </span>
      ) : null}
    </Link>
  );
}

export function ArchiveHubPage() {
  const search = useSearch({ from: "/archive" });
  const navigate = useNavigate({ from: "/archive" });
  const activeTab = search.tab ?? "overview";
  const account = useCurrentAccount().data?.account;
  const accountId = account?.id;
  const pulse = useArchivePulse();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!accountId || search.sort) return;
    const stored = window.localStorage.getItem(`arcadia:archive-sort:${accountId}`);
    if (!stored || !isLibrarySort(stored)) return;
    void navigate({
      search: (previous) => ({ ...previous, sort: stored }),
      replace: true,
    });
  }, [accountId, navigate, search.sort]);

  const counts = {
    overview: 0,
    library: pulse.librarySize,
    history: 0,
    calendar: pulse.upcoming,
    family: pulse.awaitingReply,
    notifications: pulse.unread,
  } satisfies Record<ArchiveTab, number>;
  const countLabels = {
    overview: "",
    library: "عمل في مكتبتك",
    history: "",
    calendar: "إصدار قادم",
    family: "توصية تنتظر ردّك",
    notifications: "تنبيه لم يُقرأ",
  } satisfies Record<ArchiveTab, string>;
  /** Filled counters mean "this is waiting on you"; plain counters only report a size. */
  const attention = {
    overview: false,
    library: false,
    history: false,
    calendar: false,
    family: pulse.awaitingReply > 0,
    notifications: pulse.unread > 0,
  } satisfies Record<ArchiveTab, boolean>;

  const clauses = [
    {
      key: "unfinished",
      count: pulse.unfinished,
      forms: ["عمل واحد لم يكتمل", "عملان لم يكتملا", "أعمال لم تكتمل"],
    },
    {
      key: "awaitingReply",
      count: pulse.awaitingReply,
      forms: ["توصية تنتظر ردّك", "توصيتان تنتظران ردّك", "توصيات تنتظر ردّك"],
    },
    {
      key: "unread",
      count: pulse.unread,
      forms: ["تنبيه لم يُقرأ", "تنبيهان لم يُقرآ", "تنبيهات لم تُقرأ"],
    },
    {
      key: "upcoming",
      count: pulse.upcoming,
      forms: ["إصدار واحد قادم", "إصداران قادمان", "إصدارات قادمة"],
    },
  ] as const satisfies readonly {
    key: string;
    count: number;
    forms: readonly [string, string, string];
  }[];
  const activeClauses = clauses
    .filter((clause) => clause.count > 0)
    .map((clause) => ({
      key: clause.key,
      node: <CountedNoun count={clause.count} forms={clause.forms} />,
    }));

  return (
    <PlatformShell>
      <div className="relative mx-auto max-w-400 px-5 pb-28 pt-10 sm:px-8">
        <div
          aria-hidden
          className="archive-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 opacity-80 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />

        <header>
          <p className="text-xs text-muted-foreground">{dateLineFormat.format(new Date())}</p>
          <div className="mt-5 flex items-start gap-4">
            {account ? (
              <AccountAvatar
                avatarKey={account.avatarKey}
                label={account.displayName}
                className="size-12 shrink-0 ring-1 ring-border sm:size-14"
              />
            ) : (
              <Skeleton className="size-12 shrink-0 rounded-full sm:size-14" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="text-muted-foreground">
                  {greetingForHour(new Date().getHours())}
                  {account ? "، " : ""}
                </span>
                {account?.displayName ?? ""}
              </h1>
              {pulse.loading ? (
                <Skeleton className="mt-4 h-5 w-full max-w-lg" />
              ) : (
                <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
                  <StatusSentence clauses={activeClauses} />
                </p>
              )}
            </div>
          </div>
          {online ? null : (
            <div
              role="status"
              className="mt-6 flex items-start gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground"
            >
              <WifiSlashIcon className="mt-1 size-4 shrink-0" />
              <p>
                <strong className="font-medium text-foreground">دون اتصال بخادم العائلة.</strong>{" "}
                الأعمال المحفوظة على هذا الجهاز تفتح الآن، ويستأنف التقدم والتقويم التحديث فور عودة
                الاتصال.
              </p>
            </div>
          )}
        </header>

        <div className="mt-9 border-t" />

        <div className="flex flex-col gap-6">
          <nav aria-label="أقسام مساحتي" className="w-fit max-w-full overflow-hidden">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-fade-x p-2">
              {sections.map((section) => (
                <ArchiveSectionLink
                  key={section.value}
                  value={section.value}
                  active={activeTab === section.value}
                  label={section.label}
                  hint={section.hint}
                  icon={section.icon}
                  count={counts[section.value]}
                  countLabel={countLabels[section.value]}
                  attention={attention[section.value]}
                />
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
            {activeTab === "overview" ? <ArchiveOverview /> : null}
            {activeTab === "library" ? (
              <LibraryPanel
                filter={search.filter ?? "all"}
                sort={search.sort ?? "updated"}
                onFilterChange={(filter) =>
                  void navigate({
                    search: (previous) => ({ ...previous, filter }),
                    replace: true,
                  })
                }
                onSortChange={(sort) => {
                  if (accountId) {
                    window.localStorage.setItem(`arcadia:archive-sort:${accountId}`, sort);
                  }
                  void navigate({
                    search: (previous) => ({ ...previous, sort }),
                    replace: true,
                  });
                }}
              />
            ) : null}
            {activeTab === "history" ? <HistoryPanel /> : null}
            {activeTab === "calendar" ? <CalendarPanel /> : null}
            {activeTab === "family" ? <FamilyPanel /> : null}
            {activeTab === "notifications" ? <NotificationsPanel /> : null}
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
