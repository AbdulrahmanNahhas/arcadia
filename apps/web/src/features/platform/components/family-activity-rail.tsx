import type { FamilyActivity } from "@arcadia/contracts";
import { ChatCircleDotsIcon, HeartIcon, StarIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { AccountAvatar } from "@/features/accounts/account-avatar";

const activityLabels = {
  review: "كتب مراجعة",
  comment: "شارك في النقاش",
  favorite: "أضاف إلى المفضلة",
  status: "حدّث حالة المشاهدة",
} as const;
const activityDate = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

export function FamilyActivityRail({ items }: { items: FamilyActivity[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="family-activity-title">
      <div className="mx-auto max-w-400">
        <div className="mb-5 flex items-end justify-between px-5 sm:px-8 gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-primary">معاً في المدار</p>
            <h2
              id="family-activity-title"
              className="mt-2 font-heading text-2xl font-semibold sm:text-3xl"
            >
              ما الذي تكتشفه العائلة؟
            </h2>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3 px-5 sm:px-8">
          {items.slice(0, 12).map((item) => (
            <Link
              key={`${item.kind}:${item.id}`}
              to="/titles/$titleId"
              params={{ titleId: item.title.id }}
              className="group w-72 shrink-0 snap-start rounded-2xl border border-border/50 bg-card/55 p-4 transition hover:border-primary/35 hover:bg-card"
            >
              <div className="flex items-center gap-3">
                <AccountAvatar
                  avatarKey={item.account.avatarKey}
                  label={item.account.displayName}
                  className="size-10"
                />
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{item.account.displayName}</strong>
                  <span className="text-xs text-muted-foreground">{activityLabels[item.kind]}</span>
                </div>
                <ActivityIcon kind={item.kind} />
              </div>
              <p className="mt-4 line-clamp-1 font-heading font-semibold">{item.title.name}</p>
              {item.body ? (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {item.body}
                </p>
              ) : null}
              <time
                className="mt-3 block text-[11px] text-muted-foreground"
                dateTime={item.createdAt}
              >
                {activityDate.format(new Date(item.createdAt))}
              </time>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActivityIcon({ kind }: { kind: FamilyActivity["kind"] }) {
  const className = "ms-auto size-5 text-primary";
  if (kind === "review") return <StarIcon className={className} weight="fill" />;
  if (kind === "favorite") return <HeartIcon className={className} weight="fill" />;
  return <ChatCircleDotsIcon className={className} />;
}
