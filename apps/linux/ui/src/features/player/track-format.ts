import type { PlayerTrack } from "./bridge";

const languageNames = new Intl.DisplayNames(["ar"], { type: "language" });

export function trackLanguage(track: PlayerTrack) {
  const code = track.language?.trim();
  if (!code) return "لغة غير محددة";
  try {
    return languageNames.of(code) ?? code;
  } catch {
    // Native tags that Intl does not recognize stay visible, without guessing a language.
    return code;
  }
}

export function trackSecondary(track: PlayerTrack) {
  return [
    track.title?.trim() || `مسار ${track.id}`,
    track.codec?.trim(),
    track.external ? "ملف خارجي" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function trackLabel(track: PlayerTrack) {
  return `${trackLanguage(track)} · ${trackSecondary(track)}`;
}

export function groupTracks(tracks: readonly PlayerTrack[]) {
  const groups = new Map<string, { language: string; tracks: PlayerTrack[] }>();
  for (const track of tracks) {
    const language = trackLanguage(track);
    const group = groups.get(language);
    if (group) group.tracks.push(track);
    else groups.set(language, { language, tracks: [track] });
  }
  return [...groups.values()];
}
