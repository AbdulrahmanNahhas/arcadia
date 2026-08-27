import {
  BellIcon,
  BooksIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  FolderPlusIcon,
  HeartIcon,
  PlusIcon,
  SparkleIcon,
  StarIcon,
  TrashIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import {
  archiveKeys,
  clearHistory,
  createArchiveRequest,
  createCollection,
  getArchiveRequests,
  getCalendar,
  getCollections,
  getFamilyActivity,
  getFamilyEvents,
  getHistory,
  getLibrary,
  getNotifications,
  getRecommendations,
  readNotification,
  respondRecommendation,
  toggleFollow,
  voteForEventTitle,
} from "./api";

const dateFormat = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

function PanelTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-muted-foreground">{description}</p>
    </div>
  );
}

function Loading() {
  return <p className="py-14 text-center text-muted-foreground">جارٍ ترتيب الأرشيف…</p>;
}

function Blank({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function ArchiveOverview() {
  const library = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary }).data ?? [];
  const collections =
    useQuery({ queryKey: archiveKeys.collections, queryFn: getCollections }).data ?? [];
  const calendar = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar }).data ?? [];
  const notifications =
    useQuery({ queryKey: archiveKeys.notifications, queryFn: getNotifications }).data ?? [];
  const cards = [
    ["في مكتبتي", library.length, BooksIcon, "مفضلاتك وتقييماتك"],
    ["مجموعاتي", collections.length, FolderPlusIcon, "خاصة أو مشتركة"],
    [
      "إصدارات قادمة",
      calendar.filter((item) => new Date(item.releaseDate) >= new Date()).length,
      CalendarBlankIcon,
      "خلال السنة القادمة",
    ],
    [
      "تنبيهات جديدة",
      notifications.filter((item) => !item.readAt).length,
      BellIcon,
      "ردود ونشاطات مهمة",
    ],
  ] as const;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, detail]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>{label}</CardDescription>
                <Icon className="text-primary" />
              </div>
              <CardTitle className="font-mono text-3xl">{value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>نبض الأرشيف الشخصي</CardTitle>
          <CardDescription>
            ملخّص سريع يحافظ على الفصل بين تقييمك الشخصي والتقييم التحريري.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <QuickStat
            label="مقيَّمة شخصيًا"
            value={library.filter((item) => item.personalRating !== null).length}
          />
          <QuickStat label="في المفضلة" value={library.filter((item) => item.isFavorite).length} />
          <QuickStat
            label="إصدارات أتابعها"
            value={calendar.filter((item) => item.followed).length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/55 p-5">
      <strong className="font-mono text-2xl">{value}</strong>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function LibraryPanel() {
  const query = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary });
  if (query.isLoading) return <Loading />;
  const items = query.data ?? [];
  return (
    <>
      <PanelTitle title="مكتبتي" description="المفضلة والتقييمات الشخصية في عرض واحد." />
      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.titleId}
              to="/titles/$titleId"
              params={{ titleId: item.titleId }}
              className="group flex gap-4 rounded-2xl border bg-card p-3 transition hover:border-primary/40"
            >
              <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                {item.posterPath ? (
                  <img src={item.posterPath} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 py-1">
                <h3 className="line-clamp-2 font-heading font-semibold group-hover:text-primary">
                  {item.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.isFavorite ? (
                    <Badge variant="outline">
                      <HeartIcon weight="fill" /> مفضلة
                    </Badge>
                  ) : null}
                </div>
                {item.personalRating ? (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <StarIcon weight="fill" /> {item.personalRating} / 5
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Blank icon={<BooksIcon />} title="مكتبتك جاهزة">
          أضف مفضلة أو تقييمًا شخصيًا من أي صفحة عمل.
        </Blank>
      )}
    </>
  );
}

export function HistoryPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.history, queryFn: getHistory });
  const clear = useMutation({
    mutationFn: () => clearHistory(),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.history }),
  });
  if (query.isLoading) return <Loading />;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PanelTitle title="سجل التصفح" description="آخر الأعمال التي فتحتها، محفوظة لحسابك فقط." />
        {query.data?.length ? (
          <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>
            <TrashIcon /> مسح السجل
          </Button>
        ) : null}
      </div>
      {query.data?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {query.data.map((item) => (
            <Link
              key={item.title.id}
              to="/titles/$titleId"
              params={{ titleId: item.title.id }}
              className="flex items-center gap-4 p-4 hover:bg-muted/35"
            >
              <div className="size-12 overflow-hidden rounded-xl bg-muted">
                {item.title.posterPath ? (
                  <img src={item.title.posterPath} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <strong>{item.title.title}</strong>
                <p className="text-xs text-muted-foreground">
                  {dateTimeFormat.format(new Date(item.viewedAt))}
                </p>
              </div>
              <Badge variant="outline">{item.visitCount} زيارة</Badge>
            </Link>
          ))}
        </div>
      ) : (
        <Blank icon={<ClockCounterClockwiseIcon />} title="لا يوجد سجل بعد">
          ستظهر هنا الأعمال التي تزورها لاحقاً.
        </Blank>
      )}
    </>
  );
}

export function CollectionsPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.collections, queryFn: getCollections });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState(true);
  const [ranked, setRanked] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      createCollection({ name, description, visibility: family ? "family" : "private", ranked }),
    onSuccess: async () => {
      setName("");
      setDescription("");
      await client.invalidateQueries({ queryKey: archiveKeys.collections });
    },
  });
  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>مجموعة جديدة</CardTitle>
          <CardDescription>قائمة مرنة لك أو لكل العائلة.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>الاسم</FieldLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>الوصف</FieldLabel>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <label
              htmlFor="collection-family"
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span>مرئية للعائلة</span>
              <Switch id="collection-family" checked={family} onCheckedChange={setFamily} />
            </label>
            <label
              htmlFor="collection-ranked"
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span>قائمة مرتبة</span>
              <Switch id="collection-ranked" checked={ranked} onCheckedChange={setRanked} />
            </label>
            <Button
              disabled={name.trim().length < 2 || create.isPending}
              onClick={() => create.mutate()}
            >
              <PlusIcon /> إنشاء المجموعة
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
      <section>
        <PanelTitle title="المجموعات" description="قوائم موضوعية، اختيارات مشتركة، وترتيب شخصي." />
        {query.isLoading ? (
          <Loading />
        ) : query.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.map((collection) => (
              <Card key={collection.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{collection.name}</CardTitle>
                      <CardDescription>{collection.description || "بلا وصف"}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      {collection.visibility === "family" ? "العائلة" : "خاصة"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {collection.items.length} عمل · أنشأها {collection.owner.displayName}
                  </p>
                  <div className="mt-4 flex -space-x-2 space-x-reverse">
                    {collection.items.slice(0, 5).map((item) => (
                      <div
                        key={item.title.id}
                        className="aspect-[2/3] w-11 overflow-hidden rounded-lg border-2 border-card bg-muted"
                      >
                        {item.title.posterPath ? (
                          <img
                            src={item.title.posterPath}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Blank icon={<FolderPlusIcon />} title="لا توجد مجموعات">
            أنشئ أول مجموعة من النموذج المجاور.
          </Blank>
        )}
      </section>
    </div>
  );
}

export function CalendarPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar });
  const follow = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.calendar }),
  });
  return (
    <>
      <PanelTitle
        title="تقويم الإصدارات"
        description="إصدارات الشهر السابق والسنة القادمة، مع متابعة مستقلة لكل عمل."
      />
      {query.isLoading ? (
        <Loading />
      ) : query.data?.length ? (
        <div className="space-y-3">
          {query.data.map((item) => (
            <Card key={item.installmentId}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex size-14 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <strong>{new Date(item.releaseDate).getDate()}</strong>
                  <span className="text-[10px]">
                    {new Intl.DateTimeFormat("ar", { month: "short" }).format(
                      new Date(item.releaseDate),
                    )}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/titles/$titleId"
                    params={{ titleId: item.titleId }}
                    className="font-heading font-semibold hover:text-primary"
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {item.installmentTitle} · {dateFormat.format(new Date(item.releaseDate))}
                  </p>
                </div>
                <Button
                  variant={item.followed ? "secondary" : "outline"}
                  onClick={() => follow.mutate(item.titleId)}
                >
                  {item.followed ? <CheckCircleIcon /> : <BellIcon />}
                  {item.followed ? "تتابعه" : "تابع العمل"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Blank icon={<CalendarBlankIcon />} title="لا مواعيد قريبة">
          لا توجد أجزاء مؤرخة ضمن النافذة الحالية.
        </Blank>
      )}
    </>
  );
}

export function FamilyPanel() {
  const client = useQueryClient();
  const activity = useQuery({ queryKey: archiveKeys.activity, queryFn: getFamilyActivity });
  const recommendations = useQuery({
    queryKey: archiveKeys.recommendations,
    queryFn: getRecommendations,
  });
  const events = useQuery({ queryKey: archiveKeys.events, queryFn: getFamilyEvents });
  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "deferred" | "dismissed" }) =>
      respondRecommendation(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.recommendations }),
  });
  const vote = useMutation({
    mutationFn: ({ eventId, titleId }: { eventId: string; titleId: string }) =>
      voteForEventTitle(eventId, titleId),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.events }),
  });
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section>
        <PanelTitle title="نشاط العائلة" description="ما اختار أفراد العائلة إظهاره داخل البيت." />
        <div className="space-y-3">
          {activity.data?.slice(0, 12).map((item) => (
            <Card key={item.id}>
              <CardContent className="flex gap-3 p-4">
                <AccountAvatar
                  avatarKey={item.account.avatarKey}
                  label={item.account.displayName}
                  className="size-10"
                />
                <div>
                  <p>
                    <strong>{item.account.displayName}</strong> ·{" "}
                    {item.kind === "review"
                      ? "كتب مراجعة"
                      : item.kind === "favorite"
                        ? "أضاف إلى المفضلة"
                        : "حدّث مكتبته"}
                  </p>
                  <Link
                    to="/titles/$titleId"
                    params={{ titleId: item.title.id }}
                    className="text-sm text-primary"
                  >
                    {item.title.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateTimeFormat.format(new Date(item.createdAt))}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          {activity.isLoading ? <Loading /> : null}
        </div>
      </section>
      <div className="space-y-6">
        <section>
          <PanelTitle
            title="التوصيات المباشرة"
            description="اقتراحات من شخص إلى شخص، مع قرار واضح."
          />
          <div className="space-y-3">
            {recommendations.data?.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <AccountAvatar
                      avatarKey={item.sender.avatarKey}
                      label={item.sender.displayName}
                      className="size-10"
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {item.sender.displayName} رشّح{" "}
                        <Link
                          to="/titles/$titleId"
                          params={{ titleId: item.title.id }}
                          className="text-primary"
                        >
                          {item.title.title}
                        </Link>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                    </div>
                  </div>
                  {item.status === "pending" ? (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respond.mutate({ id: item.id, status: "accepted" })}
                      >
                        سأشاهده
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respond.mutate({ id: item.id, status: "deferred" })}
                      >
                        لاحقاً
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => respond.mutate({ id: item.id, status: "dismissed" })}
                      >
                        تجاهل
                      </Button>
                    </div>
                  ) : (
                    <Badge className="mt-3" variant="secondary">
                      {item.status}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
            {!recommendations.isLoading && !recommendations.data?.length ? (
              <Blank icon={<SparkleIcon />} title="لا توصيات بعد">
                أرسل توصية من صفحة أي عمل.
              </Blank>
            ) : null}
          </div>
        </section>
        <section>
          <PanelTitle title="ليلة العائلة" description="مواعيد ومقترحات يجري حسمها بالتصويت." />
          <div className="space-y-3">
            {events.data?.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                  <CardDescription>
                    {event.scheduledFor
                      ? dateTimeFormat.format(new Date(event.scheduledFor))
                      : "الموعد قيد التخطيط"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {event.candidates.map((candidate) => (
                    <button
                      type="button"
                      key={candidate.title.id}
                      onClick={() =>
                        vote.mutate({ eventId: event.id, titleId: candidate.title.id })
                      }
                      className="flex w-full items-center justify-between rounded-xl border p-3 text-start hover:bg-muted/40"
                    >
                      <span>{candidate.title.title}</span>
                      <Badge variant={candidate.votedByMe ? "default" : "outline"}>
                        {candidate.votes} صوت
                      </Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
            {!events.isLoading && !events.data?.length ? (
              <Blank icon={<UsersThreeIcon />} title="لا توجد ليلة مخططة">
                يمكن إنشاء موعد جديد مع مقترحات للمشاهدة.
              </Blank>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function RequestsPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.requests, queryFn: getArchiveRequests });
  const [kind, setKind] = useState<"missing_work" | "correction" | "planet" | "metadata">(
    "missing_work",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () => createArchiveRequest({ kind, title, body }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await client.invalidateQueries({ queryKey: archiveKeys.requests });
    },
  });
  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>طلب جديد</CardTitle>
          <CardDescription>عمل مفقود، تصحيح، أو اقتراح تنظيمي.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>نوع الطلب</FieldLabel>
              <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing_work">عمل مفقود</SelectItem>
                  <SelectItem value="correction">تصحيح</SelectItem>
                  <SelectItem value="planet">اقتراح كوكب</SelectItem>
                  <SelectItem value="metadata">بيانات ناقصة</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>العنوان</FieldLabel>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>التفاصيل</FieldLabel>
              <Textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} />
            </Field>
            <Button
              disabled={title.trim().length < 2 || body.trim().length < 2 || create.isPending}
              onClick={() => create.mutate()}
            >
              <PlusIcon /> إرسال الطلب
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
      <section>
        <PanelTitle title="طلباتي" description="حالة كل طلب من الإنشاء حتى قرار المحرر." />
        <div className="space-y-3">
          {query.data?.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{request.title}</CardTitle>
                    <CardDescription>{request.body}</CardDescription>
                  </div>
                  <Badge variant={request.status === "resolved" ? "default" : "outline"}>
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                أرسله {request.requester.displayName} ·{" "}
                {dateFormat.format(new Date(request.createdAt))}
              </CardContent>
            </Card>
          ))}
          {query.isLoading ? <Loading /> : null}
        </div>
      </section>
    </div>
  );
}

export function NotificationsPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.notifications, queryFn: getNotifications });
  const read = useMutation({
    mutationFn: readNotification,
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.notifications }),
  });
  return (
    <>
      <PanelTitle
        title="مركز التنبيهات"
        description="ردود وتفاعلات وتحديثات الأرشيف المهمة لحسابك."
      />
      {query.isLoading ? (
        <Loading />
      ) : query.data?.length ? (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {query.data.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => !item.readAt && read.mutate(item.id)}
              className="flex w-full gap-4 p-4 text-start hover:bg-muted/35"
            >
              <span
                className={`mt-2 size-2 shrink-0 rounded-full ${item.readAt ? "bg-muted" : "bg-primary"}`}
              />
              <div className="flex-1">
                <p className={item.readAt ? "text-muted-foreground" : "font-medium"}>
                  {item.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dateTimeFormat.format(new Date(item.createdAt))}
                </p>
              </div>
              {!item.readAt ? <Badge>جديد</Badge> : null}
            </button>
          ))}
        </div>
      ) : (
        <Blank icon={<BellIcon />} title="صندوق هادئ">
          لا توجد تنبيهات الآن.
        </Blank>
      )}
    </>
  );
}
