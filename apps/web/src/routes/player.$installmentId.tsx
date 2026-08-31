import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PlayerPage } from "@/features/library/player-page";

/**
 * The player is deliberately outside the platform shell: it renders over a transparent document
 * so the native mpv surface underneath shows through, and navigation chrome would be painted on
 * top of the film.
 */
const playerSearchSchema = z.object({
  /** Where the back button returns to. */
  titleId: z.string().uuid().catch(""),
  /** Set for a TV/anime episode; absent (`null`) for a movie or special. */
  episodeId: z.string().uuid().nullable().catch(null),
});

export const Route = createFileRoute("/player/$installmentId")({
  component: PlayerRoute,
  validateSearch: playerSearchSchema,
});

function PlayerRoute() {
  const { installmentId } = Route.useParams();
  const { titleId, episodeId } = Route.useSearch();
  return <PlayerPage installmentId={installmentId} titleId={titleId} episodeId={episodeId} />;
}
