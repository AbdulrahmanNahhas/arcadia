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
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentAccount } from "@/features/accounts/api";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { revealSpatialTarget, useSpatialFocusable } from "@/features/platform/spatial-navigation";
import {
  ArchiveOverview,
  CalendarPanel,
  FamilyPanel,
  HistoryPanel,
  isLibrarySort,
  LibraryPanel,
  NotificationsPanel,
} from "./archive-panels";

const tabs = [
  ["overview", "الموجز", HouseLineIcon],
  ["library", "مكتبتي", BooksIcon],
  ["history", "السجل", ClockCounterClockwiseIcon],
  ["calendar", "التقويم", CalendarDotsIcon],
  ["family", "العائلة", UsersThreeIcon],
  ["notifications", "التنبيهات", BellIcon],
] as const;
type ArchiveTab = (typeof tabs)[number][0];

/**
 * Same manual spatial registration as the title page's `TitleTabTrigger` — arrow-focusing a tab
 * activates it immediately (`onFocus` selects, not just `onEnterPress`), rather than the
 * automatic system's plain "focus, then Enter to activate". Opts out of automatic scanning
 * (`data-spatial-managed`) so the two systems never both claim this button.
 */
function ArchiveTabTrigger({
  value,
  label,
  icon: Icon,
  onSelect,
}: {
  value: ArchiveTab;
  label: string;
  icon: Icon;
  onSelect: (value: ArchiveTab) => void;
}) {
  const focusKey = `archive:tab:${value}`;
  const { ref, focused } = useSpatialFocusable<object, HTMLButtonElement>({
    focusKey,
    accessibilityLabel: label,
    onEnterPress: () => onSelect(value),
    onFocus: ({ node }) => {
      revealSpatialTarget(node);
      onSelect(value);
    },
  });
  return (
    <TabsTrigger
      ref={ref}
      value={value}
      data-spatial-managed
      data-spatial-focus-key={focusKey}
      data-focused={focused || undefined}
      className="px-3"
    >
      <Icon data-icon="inline-start" />
      {label}
    </TabsTrigger>
  );
}

export function ArchiveHubPage() {
  const search = useSearch({ from: "/archive" });
  const navigate = useNavigate({ from: "/archive" });
  const selectTab = (tab: ArchiveTab) =>
    void navigate({ search: (previous) => ({ ...previous, tab }), replace: true });
  const accountId = useCurrentAccount().data?.account.id;
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
  return (
    <PlatformShell>
      <div className="mx-auto max-w-400 px-5 pb-28 pt-10 sm:px-8">
        <header className="archive-grid relative overflow-hidden rounded-[2rem] border bg-card p-7 sm:p-10">
          <div className="absolute inset-y-0 start-0 w-1/2 bg-[radial-gradient(circle_at_center,var(--color-primary),transparent_68%)] opacity-10" />
          <p className="relative text-xs font-semibold tracking-[0.18em] text-primary">
            مساحتك داخل الأرشيف
          </p>
          <h1 className="relative mt-3 max-w-3xl font-heading text-3xl font-semibold sm:text-5xl">
            مساحتي
          </h1>
          <p className="relative mt-4 max-w-2xl leading-8 text-muted-foreground">
            أكمل ما بدأته، قيّم ورشّح ما تشاهده، وتابع نبض العائلة وإصدارات الأعمال — من مكان واحد
            يعرف أين توقّفت.
          </p>
        </header>

        {!online ? (
          <Alert className="mt-5">
            <WifiSlashIcon />
            <AlertTitle>أنت دون اتصال بخادم العائلة</AlertTitle>
            <AlertDescription>
              تستطيع فتح الأعمال المحفوظة على هذا الجهاز. سنحدّث التقدم والتوصيات والتقويم عند عودة
              الاتصال.
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs
          value={search.tab ?? "overview"}
          onValueChange={(value) => selectTab(value)}
          className="mt-8 gap-6"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-11 min-w-max" aria-label="أقسام مساحة الأرشيف">
              {tabs.map(([value, label, Icon]) => (
                <ArchiveTabTrigger
                  key={value}
                  value={value}
                  label={label}
                  icon={Icon}
                  onSelect={selectTab}
                />
              ))}
            </TabsList>
          </div>
          <TabsContent value="overview">
            <ArchiveOverview />
          </TabsContent>
          <TabsContent value="library">
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
          </TabsContent>
          <TabsContent value="history">
            <HistoryPanel />
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarPanel />
          </TabsContent>
          <TabsContent value="family">
            <FamilyPanel />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </PlatformShell>
  );
}
