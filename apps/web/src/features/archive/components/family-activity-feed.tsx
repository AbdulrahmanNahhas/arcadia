import type { FamilyActivity } from "@arcadia/contracts";
import { StarIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { toggleReaction } from "@/features/social/api";
import { cn } from "@/lib/utils";
import { archiveKeys, getFamilyActivity } from "../api";
import { Blank, dateTimeFormat, ListSkeleton } from "./shared";

const reactionGlyphs = {
  heart: "❤️",
  clap: "👏",
  laugh: "😂",
  wow: "😮",
  think: "🤔",
} satisfies Record<string, string>;

/** `item.reactions` is keyed by whatever emoji the server aggregated, so an unknown key (a future
 * reaction kind not in `reactionGlyphs`) is expected, not a bug — fall back to the raw emoji name. */
function glyphForReaction(emoji: string): string {
  // SAFETY: `Object.hasOwn` just confirmed `emoji` names one of `reactionGlyphs`' own literal
  // keys, so the index below is guaranteed to resolve to a string, never `undefined`.
  return Object.hasOwn(reactionGlyphs, emoji)
    ? reactionGlyphs[emoji as keyof typeof reactionGlyphs]
    : emoji;
}

function isReactableKind(kind: FamilyActivity["kind"]): kind is "review" | "comment" {
  return kind !== "favorite";
}

/**
 * AniList-style family feed: ratings, reviews, comments, and reactions, newest first. Built
 * standalone and decoupled from any one panel — `variant="sidebar"` is a tighter read used in the
 * Overview tab; `variant="panel"` is the full-width read used in the Family tab. Both mount the
 * same component and query, matching the roadmap's "reusable as a sidebar" requirement scoped to
 * `/archive`'s own panels for v1 (see the doc's Open Questions table).
 */
export function FamilyActivityFeed({
  variant = "panel",
  limit,
}: {
  variant?: "panel" | "sidebar";
  limit?: number;
}) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.activity, queryFn: getFamilyActivity });
  const react = useMutation({
    mutationFn: ({ kind, id }: { kind: "review" | "comment"; id: string }) =>
      toggleReaction(kind, id, "heart"),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.activity }),
  });
  if (query.isLoading) return <ListSkeleton leading="avatar" />;
  const items = query.data ?? [];
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) {
    return (
      <Blank icon={<UsersThreeIcon />} title="لا نشاط عائلي بعد">
        تقييمات وتعليقات ومفضلات العائلة تظهر هنا فور حدوثها.
      </Blank>
    );
  }
  return (
    <div className="space-y-3">
      {shown.map((item) => {
        const reactableKind = isReactableKind(item.kind) ? item.kind : null;
        return (
          <div
            key={item.id}
            className={cn("rounded-2xl border bg-card", variant === "sidebar" ? "p-3" : "p-4")}
          >
            <div className="flex gap-3">
              <AccountAvatar
                avatarKey={item.account.avatarKey}
                label={item.account.displayName}
                className={variant === "sidebar" ? "size-8" : "size-10"}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <strong>{item.account.displayName}</strong>{" "}
                  {item.kind === "review"
                    ? "كتب مراجعة عن"
                    : item.kind === "comment"
                      ? "علّق على"
                      : "أضاف إلى المفضلة"}{" "}
                  <Link
                    to="/titles/$titleId"
                    params={{ titleId: item.title.id }}
                    className="text-primary"
                  >
                    {item.title.name}
                  </Link>
                </p>
                {item.rating !== null ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <StarIcon weight="fill" className="text-primary" /> {item.rating} / 5
                  </p>
                ) : null}
                {item.body ? (
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{item.body}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {dateTimeFormat.format(new Date(item.createdAt))}
                  </p>
                  {reactableKind ? (
                    <div className="flex items-center gap-1">
                      {Object.entries(item.reactions)
                        .filter(([, count]) => count > 0)
                        .map(([emoji, count]) => (
                          <span
                            key={emoji}
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[11px]"
                          >
                            {glyphForReaction(emoji)} {count}
                          </span>
                        ))}
                      <button
                        type="button"
                        aria-label="فاعل بإعجاب"
                        disabled={react.isPending}
                        onClick={() => react.mutate({ kind: reactableKind, id: item.id })}
                        className="rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-primary"
                      >
                        + ❤️
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
