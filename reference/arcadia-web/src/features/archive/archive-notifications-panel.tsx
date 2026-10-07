import type { Notification } from "@arcadia/contracts";
import {
  BellIcon,
  ChatCircleIcon,
  FilmSlateIcon,
  GearSixIcon,
  HeartIcon,
  type Icon,
  StarIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { cn } from "@/lib/utils";
import { archiveKeys, getNotifications, readNotification } from "./api";
import { Blank, dateFormat, ListSkeleton, PanelTitle, timeFormat } from "./components/shared";

type NotificationKind = Notification["kind"];

/** Each kind gets its own glyph so the list is scannable by shape, not only by reading every
 *  line — a reply, a reaction and a catalog change are different events, not one grey feed. */
const kindMeta = {
  reply: { label: "ردود", icon: ChatCircleIcon },
  reaction: { label: "تفاعلات", icon: HeartIcon },
  review: { label: "مراجعات", icon: StarIcon },
  catalog: { label: "الأرشيف", icon: FilmSlateIcon },
  system: { label: "النظام", icon: GearSixIcon },
} satisfies Record<NotificationKind, { label: string; icon: Icon }>;

const filters = ["all", "unread"] as const;
type NotificationFilter = (typeof filters)[number];

function isNotificationFilter(value: string): value is NotificationFilter {
  return filters.some((option) => option === value);
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000,
  );
  if (diffDays <= 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return dateFormat.format(date);
}

function groupByDay(items: Notification[]) {
  const groups = new Map<string, Notification[]>();
  for (const item of items) {
    const key = dayLabel(item.createdAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries());
}

function NotificationRow({ item, onRead }: { item: Notification; onRead: () => void }) {
  const unread = item.readAt === null;
  const meta = kindMeta[item.kind];
  const KindIcon = meta.icon;
  const body = (
    <>
      {item.actor ? (
        <AccountAvatar
          avatarKey={item.actor.avatarKey}
          label={item.actor.displayName}
          className="size-9 shrink-0"
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <KindIcon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-6", unread ? "font-medium" : "")}>
          {item.message}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <KindIcon className="size-3.5" />
          {meta.label}
          <span aria-hidden>·</span>
          <time dateTime={item.createdAt}>{timeFormat.format(new Date(item.createdAt))}</time>
        </span>
      </span>
      {unread ? (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary">
          <span className="sr-only">غير مقروء</span>
        </span>
      ) : null}
    </>
  );
  const className = cn(
    "flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-muted/40",
    unread && "bg-primary/[0.04]",
  );
  /* A notification about a title should open that title; only the ones with nowhere to go stay
   * plain buttons whose single job is marking themselves read. */
  return item.titleId ? (
    <Link
      to="/titles/$titleId"
      params={{ titleId: item.titleId }}
      onClick={() => unread && onRead()}
      className={className}
    >
      {body}
    </Link>
  ) : (
    <button type="button" onClick={() => unread && onRead()} className={className}>
      {body}
    </button>
  );
}

export function NotificationsPanel() {
  const client = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const query = useQuery({ queryKey: archiveKeys.notifications, queryFn: getNotifications });
  const read = useMutation({
    mutationFn: readNotification,
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.notifications }),
  });
  /* There is no bulk endpoint; the per-row PATCH is the whole API surface, so "read everything"
   * is exactly that call once per unread row, awaited together and invalidated once. */
  const readAll = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(readNotification)),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.notifications }),
  });

  const items = query.data ?? [];
  const unreadIds = items.filter((item) => item.readAt === null).map((item) => item.id);
  const visible = filter === "unread" ? items.filter((item) => item.readAt === null) : items;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PanelTitle
          title="مركز التنبيهات"
          description="ردود وتفاعلات وتحديثات الأرشيف المهمة لحسابك."
        />
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[filter]}
            multiple={false}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="تصفية التنبيهات"
            onValueChange={(values) => {
              const next = values[0];
              if (next && isNotificationFilter(next)) setFilter(next);
            }}
          >
            <ToggleGroupItem value="all" className="gap-1.5">
              الكل
              <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="unread" className="gap-1.5">
              غير المقروء
              <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                {unreadIds.length}
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
          {unreadIds.length ? (
            <Button
              variant="outline"
              size="sm"
              disabled={readAll.isPending}
              onClick={() => readAll.mutate(unreadIds)}
            >
              تعليم الكل كمقروء
            </Button>
          ) : null}
        </div>
      </div>

      {query.isLoading ? (
        <ListSkeleton leading="avatar" rows={5} />
      ) : visible.length ? (
        <div className="flex flex-col gap-6">
          {groupByDay(visible).map(([day, group]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="font-heading text-sm font-semibold">{day}</h3>
                <Badge variant="outline" className="font-mono tabular-nums">
                  {group.length}
                </Badge>
                <Separator className="flex-1" />
              </div>
              <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                {group.map((item) => (
                  <NotificationRow key={item.id} item={item} onRead={() => read.mutate(item.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Blank icon={<BellIcon />} title={filter === "unread" ? "لا شيء غير مقروء" : "صندوق هادئ"}>
          {filter === "unread"
            ? "قرأت كل التنبيهات. بدّل إلى «الكل» لمراجعة ما سبق."
            : "لا توجد تنبيهات الآن."}
        </Blank>
      )}
    </div>
  );
}
