import { PlayIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isDesktopShell } from "./desktop-player";

/**
 * The subset of an installment's catalog fields the play button needs to decide whether it can
 * plausibly lead anywhere. Every "can this be played" question in the app — the hero button, the
 * episode-tab installment card, and anything added later — goes through {@link unplayableReason}
 * rather than re-deriving the same three conditions independently.
 */
export interface PlayableInstallment {
  releaseStatus?: "announced" | "airing" | "completed" | "unknown";
  /** Milliseconds since epoch, or `null`/`undefined` when the catalog has no release date yet. */
  releaseAt?: number | null;
  imdbId?: string | null;
  tmdbId?: number | null;
}

/**
 * Why a play control can't lead anywhere yet, as the exact Arabic sentence a tooltip shows — or
 * `null` when the installment is a legitimate target for the player. An "announced" installment,
 * one with no release date yet, or one whose release date is still in the future all read as "لم
 * يُصدر بعد": the family shouldn't need to know which of those three is technically true, only
 * that there's nothing to watch yet. Only once something has actually released does a missing
 * IMDb/TMDB id become the reason — that one is a cataloging gap, not a release-calendar fact.
 */
export function unplayableReason(installment: PlayableInstallment): string | null {
  const releasedAt = installment.releaseAt ?? null;
  const hasReleased =
    installment.releaseStatus !== "announced" && releasedAt !== null && releasedAt <= Date.now();
  if (!hasReleased) return "لم يُصدر بعد";
  if (!installment.imdbId && !installment.tmdbId) return "لا يتوفر معرّف تشغيل بعد";
  return null;
}

/**
 * Detects the Tauri shell after mount rather than during render.
 *
 * The same bundle prerenders to static HTML and runs in a plain browser under Playwright, where
 * `window` either does not exist or carries no Tauri globals. Reading it during the first render
 * would make the server and client disagree and produce a hydration mismatch, so the first paint
 * always assumes "browser" and the desktop affordance appears an instant later.
 */
const neverChanges = () => () => {};

export function useIsDesktopShell() {
  // The server snapshot is always `false`, so the prerendered HTML and the first client render
  // agree; the real answer arrives on the next commit. Whether we are inside Tauri never changes
  // during a session, so the subscription is a no-op.
  return useSyncExternalStore(neverChanges, isDesktopShell, () => false);
}

/**
 * A native `disabled` button stops delivering pointer/focus events at the browser level — the
 * CSS class list even says so (`disabled:pointer-events-none`) — which means a `Tooltip` wrapped
 * around one can never actually open on hover or keyboard focus. Base UI's `focusableWhenDisabled`
 * keeps the element a real, event-receiving `<button>` and swaps in `aria-disabled` instead, while
 * `useButton`'s own click/keydown guards still block activation — so the control stays exactly as
 * inert as a truly disabled one, minus the bug where its explanation could never be read. Styling
 * keys off `aria-disabled` rather than `disabled:` for the same reason.
 */
function DisabledPlayButton({
  size,
  className,
  label,
  reason,
}: {
  size: "default" | "sm" | "lg";
  className?: string;
  label: string;
  reason: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size={size}
            className={cn("aria-disabled:opacity-50", className)}
            disabled
            focusableWhenDisabled
          />
        }
      >
        <PlayIcon weight="fill" data-icon="inline-start" /> {label}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The one way into the player. Degrades to a disabled button that says why instead of a link that
 * can 404, for two independent reasons checked in order: the installment itself may not be a real
 * playable target yet ({@link unplayableReason} — unreleased, or released with no catalog id to
 * search a source by), or the app may not be running in the desktop shell that can play anything
 * at all. The first is a fact about the catalog and takes priority even on desktop; the second is
 * also what keeps the existing e2e suite (always a browser, never Tauri) green.
 */
export function PlayFilmButton({
  installmentId,
  titleId,
  label = "تشغيل الفيلم",
  size = "default",
  className,
  releaseStatus,
  releaseAt,
  imdbId,
  tmdbId,
}: {
  installmentId: string;
  titleId: string;
  label?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
} & PlayableInstallment) {
  const desktop = useIsDesktopShell();
  const reason = unplayableReason({ releaseStatus, releaseAt, imdbId, tmdbId });

  if (reason) {
    return <DisabledPlayButton size={size} className={className} label={label} reason={reason} />;
  }

  if (!desktop) {
    return (
      <DisabledPlayButton
        size={size}
        className={className}
        label={label}
        reason="متاح في تطبيق سطح المكتب"
      />
    );
  }

  return (
    <Link
      to="/player/$installmentId" // TODO: CHANGE!!! to $installmentId
      params={{ installmentId }}
      search={{ titleId, episodeId: null }}
      className={cn(buttonVariants({ size }), className)}
    >
      <PlayIcon weight="fill" data-icon="inline-start" /> {label}
    </Link>
  );
}

/**
 * The subset of an episode's fields the episode play button needs — mirrors
 * {@link PlayableInstallment}, but the id check is against the **title's** IMDb/TMDB id, never
 * the episode's own: a season/episode never carries its own catalog identifier (Phase 0's
 * design), only the umbrella title does. `episodeNumber` also has to be a plain integer — the
 * Stremio series id spec (`{imdbId}:{season}:{episode}`) has no slot for a fractional (half-
 * numbered special) episode number.
 */
export interface PlayableEpisode {
  releaseStatus?: "announced" | "airing" | "completed" | "unknown";
  releaseAt?: number | null;
  titleImdbId?: string | null;
  titleTmdbId?: number | null;
  episodeNumber: number | null;
}

export function unplayableEpisodeReason(episode: PlayableEpisode): string | null {
  const releasedAt = episode.releaseAt ?? null;
  // A season marked "completed" has, by definition, already fully aired — most catalogued
  // seasons only carry a season-level release date, not one per episode, so requiring an
  // individual `releaseAt` here would leave every episode of an otherwise-finished season stuck
  // reading as unreleased. `releaseAt` still decides it for an "airing"/"unknown" season, where
  // only some episodes are out yet.
  const hasReleased =
    episode.releaseStatus === "completed" ||
    (episode.releaseStatus !== "announced" && releasedAt !== null && releasedAt <= Date.now());
  if (!hasReleased) return "لم تُصدر بعد";
  if (!episode.titleImdbId && !episode.titleTmdbId) return "لا يتوفر معرّف تشغيل بعد";
  if (episode.episodeNumber === null || !Number.isInteger(episode.episodeNumber))
    return "رقم حلقة غير صالح للتشغيل";
  return null;
}

/**
 * {@link PlayFilmButton}'s sibling for one TV/anime episode — same degrade-to-disabled shape,
 * same desktop-shell gate, but checked against {@link unplayableEpisodeReason} and always carries
 * an `episodeId` into the player.
 */
export function PlayEpisodeButton({
  installmentId,
  episodeId,
  titleId,
  label = "تشغيل الحلقة",
  size = "default",
  className,
  releaseStatus,
  releaseAt,
  titleImdbId,
  titleTmdbId,
  episodeNumber,
}: {
  installmentId: string;
  episodeId: string;
  titleId: string;
  label?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
} & PlayableEpisode) {
  const desktop = useIsDesktopShell();
  const reason = unplayableEpisodeReason({
    releaseStatus,
    releaseAt,
    titleImdbId,
    titleTmdbId,
    episodeNumber,
  });

  if (reason) {
    return <DisabledPlayButton size={size} className={className} label={label} reason={reason} />;
  }

  if (!desktop) {
    return (
      <DisabledPlayButton
        size={size}
        className={className}
        label={label}
        reason="متاح في تطبيق سطح المكتب"
      />
    );
  }

  return (
    <Link
      to="/player/$installmentId"
      params={{ installmentId }}
      search={{ titleId, episodeId }}
      className={cn(buttonVariants({ size }), className)}
    >
      <PlayIcon weight="fill" data-icon="inline-start" /> {label}
    </Link>
  );
}
