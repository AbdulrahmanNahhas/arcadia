import { UsersThreeIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { archiveKeys, getRecommendations, respondRecommendation } from "../api";
import { Blank, dateFormat, Failed, ListSkeleton } from "./shared";

/** Short preview of pending person-to-person recommendations — the full inbox lives in `FamilyPanel`. */
export function RecommendationsPreview() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: archiveKeys.recommendations,
    queryFn: getRecommendations,
  });
  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "deferred" | "dismissed" }) =>
      respondRecommendation(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.recommendations }),
  });
  if (query.isLoading) return <ListSkeleton leading="avatar" />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const pending = (query.data ?? []).filter((item) => item.status === "pending").slice(0, 3);
  if (!pending.length) {
    return (
      <Blank icon={<UsersThreeIcon />} title="لا توصيات جديدة">
        عندما يرشّح لك أحد أفراد العائلة عملاً سيظهر هنا مع السبب.
      </Blank>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {pending.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-xl border bg-background/35">
          <Link
            to="/titles/$titleId"
            params={{ titleId: item.title.id }}
            className="flex items-center gap-3 p-3 hover:bg-muted/35"
          >
            <AccountAvatar
              avatarKey={item.sender.avatarKey}
              label={item.sender.displayName}
              className="size-10"
            />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{item.title.title}</strong>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {item.sender.displayName}: {item.reason}
              </span>
              <time
                dateTime={item.createdAt}
                className="mt-1 block text-[10px] text-muted-foreground"
              >
                أُرسلت {dateFormat.format(new Date(item.createdAt))}
              </time>
            </span>
          </Link>
          <div className="flex items-center gap-1 border-t p-1.5">
            <Button
              size="sm"
              variant="ghost"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: item.id, status: "accepted" })}
            >
              قبول
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: item.id, status: "deferred" })}
            >
              لاحقًا
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto text-muted-foreground"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: item.id, status: "dismissed" })}
            >
              تجاهل
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
