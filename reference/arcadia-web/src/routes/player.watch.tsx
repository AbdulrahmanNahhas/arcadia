import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PlayerPage } from "@/features/library/player/player-page";

/**
 * The watch hub's player: `/player/watch?imdbId=tt…&season=&episode=`. The same player as
 * `/player/$installmentId`, resolving sources by IMDb id instead of by catalog unit — no title,
 * no progress, no downloads. Static segment, so it wins over the `$installmentId` param.
 */
const watchSearchSchema = z.object({
  imdbId: z
    .string()
    .regex(/^tt\d{7,10}$/)
    .catch(""),
  season: z.coerce.number().int().min(0).nullable().catch(null),
  episode: z.coerce.number().int().min(1).nullable().catch(null),
  origin: z
    .string()
    .refine((value) => value.startsWith("/") && !value.startsWith("//"))
    .nullable()
    .catch(null),
});

export const Route = createFileRoute("/player/watch")({
  component: WatchPlayerRoute,
  validateSearch: watchSearchSchema,
});

function WatchPlayerRoute() {
  const { imdbId, season, episode, origin } = Route.useSearch();
  return (
    <PlayerPage
      installmentId="watch"
      titleId=""
      episodeId={null}
      origin={origin ?? "/watch"}
      watch={{ imdbId, season, episode }}
    />
  );
}
