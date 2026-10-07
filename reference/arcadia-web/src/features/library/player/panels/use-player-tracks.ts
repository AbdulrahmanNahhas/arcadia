import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { desktopPlayer, listPlayerTracks } from "../../desktop-player";

const trackListKey = (kind: "audio" | "sub") => ["player", "tracks", kind] as const;

/**
 * mpv's embedded tracks of one kind, re-read after every selection — without that the checkmark
 * freezes on whatever was selected when the panel opened, which is what made switching *back* to
 * a track look broken. `undefined` until the first read lands, so "loading" and "none" stay
 * distinct. Always refetched on mount: a subtitle download since the last open adds a track.
 */
export function usePlayerTracks(kind: "audio" | "sub") {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: trackListKey(kind),
    queryFn: () => listPlayerTracks(kind),
    staleTime: 0,
    gcTime: 0,
  });

  const refresh = useCallback(
    () => client.invalidateQueries({ queryKey: trackListKey(kind) }),
    [client, kind],
  );

  const select = useCallback(
    async (id: string) => {
      await desktopPlayer.setProperty(kind === "audio" ? "aid" : "sid", id).catch(() => undefined);
      await refresh();
    },
    [kind, refresh],
  );

  return { tracks: query.data ?? null, refresh, select };
}
