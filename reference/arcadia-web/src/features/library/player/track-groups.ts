import type { SubtitleCandidate } from "@arcadia/contracts";
import type { PlayerTrack } from "../desktop-player";
import { type LanguageInfo, languageInfo } from "./languages";

/**
 * One language row in the audio/subtitle pickers. A group with a single entry selects it
 * directly; a group with several (two English subtitle tracks, say — full and SDH) expands so the
 * family picks the variant, which is the whole reason the pickers group rather than list.
 */
export interface LanguageGroup<TItem> {
  language: LanguageInfo;
  items: TItem[];
  /** Whether any item in the group is the active one. */
  selected: boolean;
}

interface GroupOptions {
  /** Languages offered by default, in the order they should appear. */
  curated: readonly string[];
  /** Whether languages outside `curated` are included. A selected group is always included. */
  showAll: boolean;
}

function groupBy<TItem>(
  items: readonly TItem[],
  languageOf: (item: TItem) => string | null,
  isSelected: (item: TItem) => boolean,
): LanguageGroup<TItem>[] {
  const groups = new Map<string, LanguageGroup<TItem>>();
  for (const item of items) {
    const language = languageInfo(languageOf(item));
    const group = groups.get(language.code) ?? { language, items: [], selected: false };
    group.items.push(item);
    group.selected ||= isSelected(item);
    groups.set(language.code, group);
  }
  return [...groups.values()];
}

/** Curated languages first in their configured order, the rest alphabetically by label. */
function orderGroups<TItem>(
  groups: LanguageGroup<TItem>[],
  curated: readonly string[],
): LanguageGroup<TItem>[] {
  const rank = (group: LanguageGroup<TItem>) => {
    const index = curated.indexOf(group.language.code);
    return index < 0 ? curated.length : index;
  };
  return groups.toSorted((left, right) => {
    const byRank = rank(left) - rank(right);
    return byRank !== 0 ? byRank : left.language.label.localeCompare(right.language.label, "ar");
  });
}

function applyVisibility<TItem>(
  groups: LanguageGroup<TItem>[],
  { curated, showAll }: GroupOptions,
) {
  const visible = showAll
    ? groups
    : groups.filter((group) => group.selected || curated.includes(group.language.code));
  return { visible, hiddenCount: groups.length - visible.length };
}

/** Groups mpv's own `track-list` entries (audio or subtitle) by language. */
export function groupPlayerTracks(tracks: readonly PlayerTrack[], options: GroupOptions) {
  const groups = orderGroups(
    groupBy(
      tracks,
      (track) => track.lang,
      (track) => track.selected,
    ),
    options.curated,
  );
  return applyVisibility(groups, options);
}

/** Groups OpenSubtitles search results by language; nothing is "selected" until downloaded. */
export function groupSubtitleCandidates(
  candidates: readonly SubtitleCandidate[],
  options: GroupOptions,
) {
  const groups = orderGroups(
    groupBy(
      candidates,
      (candidate) => candidate.language,
      () => false,
    ),
    options.curated,
  );
  return applyVisibility(groups, options);
}

/**
 * The secondary line for one track inside an expanded group: the container title when the muxer
 * wrote one (`"SDH"`, `"Forced"`, `"Commentary"`), otherwise a numbered fallback so two otherwise
 * identical rows are still distinguishable.
 */
export function trackVariantLabel(track: PlayerTrack, index: number): string {
  return track.title?.trim() || `المسار ${index + 1}`;
}
