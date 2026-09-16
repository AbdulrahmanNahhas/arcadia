import {
  BookmarkSimpleIcon,
  DotsThreeVerticalIcon,
  HeartIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { archiveKeys, getLibrary } from "@/features/archive/api";
import { RecommendDialog } from "@/features/archive/recommend-dialog";
import { syncTitleOfflineCache } from "@/features/library/saved-offline";
import { updateTitleState } from "@/features/social/api";
import { RatingStars } from "@/features/social/rating-stars";
import { cn } from "@/lib/utils";

type PersonalState = { isFavorite: boolean; personalRating: number | null; savedOffline: boolean };
const untouched: PersonalState = { isFavorite: false, personalRating: null, savedOffline: false };

/** Stops a click reaching the card's own `<Link>` (these controls are siblings positioned over it,
 *  not nested inside it — an interactive control belongs beside an anchor, not inside one). */
function stopCardNavigation(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * One title's personal state (favorite / offline / rating) plus the writer for it, shared by the
 * quick-action buttons on a card and the fuller popover behind its "⋮" — so a heart rendered in
 * two places can never disagree about what it is toggling or how it persists.
 *
 * Reads come from `getLibrary()`, the same bulk per-account query My Space already fetches:
 * TanStack Query dedupes every card's use of that key into one request per page, not one per card.
 */
export function useWorkPersonalState(titleId: string) {
  const queryClient = useQueryClient();
  const library = useQuery({
    queryKey: archiveKeys.library,
    queryFn: getLibrary,
    staleTime: 30_000,
  });
  const mutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateTitleState>[1]) => {
      if (input.savedOffline !== undefined) {
        await syncTitleOfflineCache(titleId, input.savedOffline);
      }
      return updateTitleState(titleId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: archiveKeys.library }),
  });

  return {
    state: library.data?.find((item) => item.titleId === titleId) ?? untouched,
    pending: mutation.isPending,
    update: mutation.mutate,
  };
}

/**
 * A round control that sits on top of catalog artwork. `data-spatial-managed` keeps it out of the
 * spatial-navigation engine's automatic registration: arrowing into a small button stacked on the
 * card it belongs to was the "hard to focus" problem the card's hold-Enter menu replaced, because
 * the engine's distance math assumes targets don't overlap. Pointer and Tab users reach it
 * normally; remote users reach the same actions by holding OK on the card.
 */
function TrayButton({
  label,
  pressed,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      data-spatial-managed
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={(event) => {
        stopCardNavigation(event);
        onClick();
      }}
      onPointerDown={stopCardNavigation}
      className={cn(
        "border-border/60 shadow-md shadow-foreground/20 hover:scale-110 motion-reduce:hover:scale-100",
        pressed && "text-primary",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/**
 * The card's action tray: the two toggles worth reaching without opening anything (favorite,
 * save offline) followed by the "⋮" that opens the rest. It reveals on hover/focus rather than
 * sitting on every poster at rest — a permanent button over each piece of artwork was the loudest
 * thing in a dense grid, and the artwork is what the browse surfaces are for.
 *
 * Coarse pointers have no hover to reveal anything with, so there the tray collapses to the "⋮"
 * alone and stays visible (see the "avoid hover-only controls" rule in `v0.3-roadmap.md`): one
 * compact affordance that opens every action, instead of three that never appear.
 */
export function WorkCardActionTray({
  titleId,
  title,
  open,
  onOpenChange,
  className,
}: {
  titleId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const { state, pending, update } = useWorkPersonalState(titleId);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <TrayButton
        label={state.isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
        pressed={state.isFavorite}
        disabled={pending}
        onClick={() => update({ isFavorite: !state.isFavorite })}
        className="hidden pointer-fine:inline-flex"
      >
        <HeartIcon weight={state.isFavorite ? "fill" : "regular"} />
      </TrayButton>
      <TrayButton
        label={state.savedOffline ? "إزالة الحفظ دون اتصال" : "احفظ دون اتصال"}
        pressed={state.savedOffline}
        disabled={pending}
        onClick={() => update({ savedOffline: !state.savedOffline })}
        className="hidden pointer-fine:inline-flex"
      >
        <BookmarkSimpleIcon weight={state.savedOffline ? "fill" : "regular"} />
      </TrayButton>
      <WorkCardActions titleId={titleId} title={title} open={open} onOpenChange={onOpenChange} />
    </div>
  );
}

/**
 * One row of the action menu, in the same visual language as the app's own menus
 * (`components/ui/dropdown-menu.tsx`): full-bleed hit area, icon and label on one baseline, the
 * accent surface on hover and on keyboard focus alike. A toggled-on row fills its icon and takes
 * the primary color, so the menu can be read at a glance without opening anything else.
 */
function MenuRow({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof HeartIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm outline-hidden",
        "transition-colors duration-150 motion-reduce:transition-none",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:bg-accent focus-visible:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        active && "text-primary hover:text-primary focus-visible:text-primary",
      )}
    >
      <Icon weight={active ? "fill" : "regular"} />
      {label}
    </button>
  );
}

/**
 * The one card-action pattern (favorite / save-offline / rate / recommend) — same icons, labels,
 * and behavior as the My Space library grid (`archive/components/library-panel.tsx`'s
 * `LibraryCard`), reused
 * wherever a `WorkCard` appears (rails, browse grid, related-works, search) rather than each
 * surface growing its own buttons. Watched/unwatched is deliberately not here: that toggle needs
 * per-installment playback data a generic catalog card doesn't have loaded, and already has a
 * consistent home on the title/episode surfaces that do (`work-detail-page.tsx`).
 *
 * The menu names the work it is about in its own header: opened from a rail of a dozen posters,
 * the popover otherwise floats free of whatever was clicked, and "أضف إلى المفضلة" alone never
 * says which title is about to be favorited.
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
  const { state, pending, update } = useWorkPersonalState(titleId);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;
  const [recommendOpen, setRecommendOpen] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              data-spatial-managed
              aria-label="خيارات العمل"
              onClick={stopCardNavigation}
              onPointerDown={stopCardNavigation}
              className={cn(
                "border-border/60 shadow-md shadow-foreground/20 hover:scale-110 data-popup-open:text-primary motion-reduce:hover:scale-100",
                className,
              )}
            />
          }
        >
          <DotsThreeVerticalIcon weight="bold" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-60 gap-0 p-1.5"
          onClick={stopCardNavigation}
          onPointerDown={stopCardNavigation}
        >
          <p className="truncate px-3 pb-2 pt-1.5 font-heading text-sm font-semibold">{title}</p>
          <Separator />
          <div className="flex flex-col py-1">
            <MenuRow
              icon={HeartIcon}
              label={state.isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
              active={state.isFavorite}
              disabled={pending}
              onClick={() => update({ isFavorite: !state.isFavorite })}
            />
            <MenuRow
              icon={BookmarkSimpleIcon}
              label={state.savedOffline ? "إزالة الحفظ دون اتصال" : "احفظ دون اتصال"}
              active={state.savedOffline}
              disabled={pending}
              onClick={() => update({ savedOffline: !state.savedOffline })}
            />
            <MenuRow
              icon={PaperPlaneTiltIcon}
              label="رشّح لشخص"
              onClick={() => {
                setOpen(false);
                setRecommendOpen(true);
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-2.5 px-3 py-1.5">
            <span className="text-sm text-muted-foreground">تقييمك</span>
            <RatingStars
              size="sm"
              value={state.personalRating}
              disabled={pending}
              onRate={(next) => update({ personalRating: next })}
            />
          </div>
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
