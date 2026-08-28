import {
  BellIcon,
  BooksIcon,
  CalendarDotsIcon,
  ClockCounterClockwiseIcon,
  HouseLineIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  ArchiveOverview,
  CalendarPanel,
  FamilyPanel,
  HistoryPanel,
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

export function ArchiveHubPage() {
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

        <Tabs defaultValue="overview" className="mt-8 gap-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-11 min-w-max" aria-label="أقسام مساحة الأرشيف">
              {tabs.map(([value, label, Icon]) => (
                <TabsTrigger key={value} value={value} className="px-3">
                  <Icon data-icon="inline-start" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="overview">
            <ArchiveOverview />
          </TabsContent>
          <TabsContent value="library">
            <LibraryPanel />
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
