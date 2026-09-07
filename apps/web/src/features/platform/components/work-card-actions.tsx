import {
  BookmarkSimpleIcon,
  DotsThreeVerticalIcon,
  HeartIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { archiveKeys, getLibrary } from "@/features/archive/api";
import { RecommendDialog } from "@/features/archive/recommend-dialog";
import { syncTitleOfflineCache } from "@/features/library/saved-offline";
import { updateTitleState } from "@/features/social/api";
import { RatingStars } from "@/features/social/rating-stars";
import { cn } from "@/lib/utils";

type PersonalState = { isFavorite: boolean; personalRating: number | null; savedOffline: boolean };
const untouched: PersonalState = { isFavorite: false, personalRating: null, savedOffline: false };

/** Stops a click reaching the card's own `<Link>` (this trigger is a sibling positioned over it,
 *  not nested inside it — an interactive control belongs beside an anchor, not inside one). */
function stopCardNavigation(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * The one card-action pattern (favorite / save-offline / rate / recommend) — same icons, labels,
 * and behavior as the My Space library grid (`archive-panels.tsx`'s `LibraryCard`), reused
 * wherever a `WorkCard` appears (rails, browse grid, related-works, search) rather than each
 * surface growing its own buttons. Watched/unwatched is deliberately not here: that toggle needs
 * per-installment playback data a generic catalog card doesn't have loaded, and already has a
 * consistent home on the title/episode surfaces that do (`work-detail-page.tsx`).
 *
 * A single always-visible trigger — not hover-only, so keyboard, remote, and touch reach it the
 * same way a pointer does (see the "avoid hover-only controls" rule in `v0.3-roadmap.md`) — opens
 * a popover with the actions, keeping dense grids and rails legible instead of a permanent row of
 * five icons under every poster.
 *
 * Personal state comes from `getLibrary()`, the same bulk per-account query My Space already
 * fetches — TanStack Query dedupes every card's use of the same query key into one request per
 * page, not one per card.
 */
export function WorkCardActions({
  titleId,
  title,
  className,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  titleId: string;
  title: string;
  className?: string;
  /** Lets a long-press on the card itself (`work-card.tsx`) open the same menu the visible
   *  trigger does — omit both for a standalone, self-contained popover. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const library = useQuery({
    queryKey: archiveKeys.library,
    queryFn: getLibrary,
    staleTime: 30_000,
  });
  const state: PersonalState = library.data?.find((item) => item.titleId === titleId) ?? untouched;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;
  const [recommendOpen, setRecommendOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateTitleState>[1]) => {
      if (input.savedOffline !== undefined) {
        await syncTitleOfflineCache(titleId, input.savedOffline);
      }
      return updateTitleState(titleId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: archiveKeys.library }),
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          onClick={stopCardNavigation}
          onPointerDown={stopCardNavigation}
          aria-label="خيارات العمل"
          className={cn(
            "flex size-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm ring-1 ring-white/15 transition-[background-color,box-shadow] duration-150 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-popup-open:ring-2 data-popup-open:ring-primary motion-reduce:transition-none",
            className,
          )}
        >
          <DotsThreeVerticalIcon size={17} weight="bold" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-56 p-1.5"
          onClick={stopCardNavigation}
          onPointerDown={stopCardNavigation}
        >
          <button
            type="button"
            aria-pressed={state.savedOffline}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ savedOffline: !state.savedOffline })}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition hover:bg-accent",
              state.savedOffline && "text-primary",
            )}
          >
            <BookmarkSimpleIcon weight={state.savedOffline ? "fill" : "regular"} />
            {state.savedOffline ? "إزالة الحفظ دون اتصال" : "احفظ دون اتصال"}
          </button>
          <button
            type="button"
            aria-pressed={state.isFavorite}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ isFavorite: !state.isFavorite })}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition hover:bg-accent",
              state.isFavorite && "text-primary",
            )}
          >
            <HeartIcon weight={state.isFavorite ? "fill" : "regular"} />
            {state.isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
          </button>
          <div className="flex items-center justify-between gap-2.5 px-2.5 py-2 text-sm">
            <span className="text-muted-foreground">تقييمك</span>
            <RatingStars
              size="sm"
              value={state.personalRating}
              disabled={mutation.isPending}
              onRate={(next) => mutation.mutate({ personalRating: next })}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setRecommendOpen(true);
            }}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition hover:bg-accent"
          >
            <PaperPlaneTiltIcon />
            رشّح لشخص
          </button>
        </PopoverContent>
      </Popover>
      <RecommendDialog
        titleId={titleId}
        title={title}
        open={recommendOpen}
        onOpenChange={setRecommendOpen}
      />
    </>
  );
}
