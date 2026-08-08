import {
  ActivityIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  GearIcon,
  ListBulletsIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AppHeader,
  HeaderActions,
  headerOutlineButtonClassName,
  headerPrimaryButtonClassName,
  PageHeaderTitle,
} from "@/components/app-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { statusLabel } from "@/features/library/components/tracking-form";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";
import { getTrackingPage, getWorkStructures, getWorks } from "@/server/library.functions";
import { AddTrackingDialog } from "./activity-feed/add-tracking-dialog";
import { ActivityCalendarPanel } from "./activity-feed/calendar-tab";
import { FeedPanel } from "./activity-feed/feed-tab";
import { SummaryPanel } from "./activity-feed/summary-tab";
import { type FeedGrouping, groupEntries, summarizeEntries } from "./activity-feed-utils";

const trackingStatuses = [
  "saved",
  "planned",
  "in-progress",
  "completed",
  "paused",
  "dropped",
] as const;

export function ActivityFeedPage({ embedded = false }: { embedded?: boolean }) {
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  });
  const [workId, setWorkId] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [grouping, setGrouping] = useState<FeedGrouping>("week");
  const [entryOpen, setEntryOpen] = useState(false);
  const query = useQuery({
    queryKey: ["tracking-feed", workId, status, dateFrom, dateTo],
    queryFn: () =>
      getTrackingPage({
        data: {
          limit: 10_000,
          workId: workId === "all" ? undefined : workId,
          statuses: status === "all" ? undefined : [status as Work["status"]],
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      }),
  });
  const entries = query.data?.items ?? [];
  const activeWorkIds = useMemo(
    () => [...new Set(entries.map((entry) => entry.workId))].sort(),
    [entries],
  );
  const structuresQuery = useQuery({
    queryKey: ["tracking-structures", activeWorkIds],
    queryFn: () => getWorkStructures({ data: { workIds: activeWorkIds } }),
    enabled: activeWorkIds.length > 0,
  });
  const structuresById = useMemo(
    () => new Map((structuresQuery.data ?? []).map((structure) => [structure.workId, structure])),
    [structuresQuery.data],
  );
  const worksById = useMemo(() => new Map(works.map((work) => [work.id, work])), [works]);
  const groups = useMemo(() => groupEntries(entries, grouping), [entries, grouping]);
  const summary = useMemo(() => summarizeEntries(entries, worksById), [entries, worksById]);
  const filtersActive = workId !== "all" || status !== "all" || Boolean(dateFrom || dateTo);

  const clearFilters = () => {
    setWorkId("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div
      dir="rtl"
      className={
        embedded
          ? "min-w-0 overflow-x-clip p-5"
          : "min-h-screen overflow-x-clip bg-background text-foreground"
      }
    >
      {!embedded ? (
        <AppHeader className="max-w-6xl">
          <PageHeaderTitle
            title="النشاط"
            subtitle="سجل التقدم والتحديثات الأخيرة"
            icon={<ActivityIcon weight="duotone" />}
          />

          <HeaderActions>
            <Button
              // variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link to="/admin" />}
              className={cn(headerOutlineButtonClassName, "hidden sm:inline-flex")}
            >
              <GearIcon data-icon="inline-start" />
              لوحة الإدارة
            </Button>

            <Button
              size="sm"
              onClick={() => setEntryOpen(true)}
              className={headerPrimaryButtonClassName}
            >
              <PlusIcon data-icon="inline-start" />
              <span className="hidden xs:inline">إضافة تقدم</span>
              <span className="xs:hidden">إضافة</span>
            </Button>
          </HeaderActions>
        </AppHeader>
      ) : null}

      <main
        className={
          embedded
            ? "flex min-w-0 flex-col gap-6 overflow-x-clip"
            : "mx-auto flex max-w-6xl min-w-0 flex-col gap-6 overflow-x-clip px-4 py-6 sm:px-6 lg:py-8"
        }
      >
        {embedded ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-semibold">المتعقّب والنشاط</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                إدارة حالات المتابعة والتقدم والسجل الزمني من مكان واحد.
              </p>
            </div>
            <Button nativeButton={false} render={<Link to="/admin/tracker/new" />}>
              <PlusIcon data-icon="inline-start" />
              تسجيل تقدم
            </Button>
          </div>
        ) : null}
        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader className="border-b">
            <CardTitle>اعرض السجل كما تحتاج</CardTitle>
            <CardDescription>
              اختر عملاً أو حالة أو نطاقاً زمنياً. يؤثر التحديد في السجل والملخص والتقويم معاً.
            </CardDescription>
            {filtersActive ? (
              <CardAction>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  مسح التصفية
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="feed-work">العمل</FieldLabel>
                <Select value={workId} onValueChange={(value) => value && setWorkId(value)}>
                  <SelectTrigger id="feed-work" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">كل الأعمال</SelectItem>
                      {works.map((work) => (
                        <SelectItem key={work.id} value={work.id}>
                          {work.arabicTitle || work.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-status">الحالة</FieldLabel>
                <Select value={status} onValueChange={(value) => value && setStatus(value)}>
                  <SelectTrigger id="feed-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      {trackingStatuses.map((value) => (
                        <SelectItem key={value} value={value}>
                          {statusLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-from">من تاريخ</FieldLabel>
                <Input
                  id="feed-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-to">إلى تاريخ</FieldLabel>
                <Input
                  id="feed-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {query.error ? (
          <Alert variant="destructive">
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="feed" className="min-w-0 gap-6">
          <TabsList aria-label="عرض النشاط" className="max-w-full">
            <TabsTrigger value="feed">
              <ListBulletsIcon data-icon="inline-start" />
              السجل
              <Badge variant="secondary" className="ms-1">
                {entries.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="summary">
              <ChartBarIcon data-icon="inline-start" />
              ملخص
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarBlankIcon data-icon="inline-start" />
              التقويم
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="min-w-0">
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">تنظيم السجل</p>
                <p className="text-xs text-muted-foreground">
                  كل يوم يحتفظ بترتيبه، وتظهر كل الحلقات والفصول بين نقطتي التقدم من دون قفزات
                  مخفية.
                </p>
              </div>
              <ToggleGroup
                value={[grouping]}
                multiple={false}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="طريقة تنظيم السجل"
                onValueChange={(value) => {
                  if (value[0]) setGrouping(value[0] as FeedGrouping);
                }}
              >
                <ToggleGroupItem value="day">يومي</ToggleGroupItem>
                <ToggleGroupItem value="week">أسبوعي</ToggleGroupItem>
                <ToggleGroupItem value="month">شهري</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <FeedPanel
              groups={groups}
              grouping={grouping}
              worksById={worksById}
              structuresById={structuresById}
              isPending={query.isPending}
              filtersActive={filtersActive}
            />
          </TabsContent>

          <TabsContent value="summary" className="min-w-0">
            <SummaryPanel summary={summary} worksById={worksById} />
          </TabsContent>

          <TabsContent value="calendar" className="min-w-0">
            <ActivityCalendarPanel entries={entries} worksById={worksById} />
          </TabsContent>
        </Tabs>
      </main>

      {!embedded ? (
        <AddTrackingDialog open={entryOpen} onOpenChange={setEntryOpen} works={works} />
      ) : null}
    </div>
  );
}
