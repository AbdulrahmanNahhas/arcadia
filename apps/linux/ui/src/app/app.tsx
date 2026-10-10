import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Login } from "../features/auth/login";
import { Library } from "../features/library/library";
import { PlayerHost, usePlayerSnapshot } from "../features/player";
import { openWatch } from "../features/player/playback";
import { SourceControls } from "../features/player/source-controls";
import {
  WatchTargetSchema,
  watchRequestEvent,
  type WatchTarget,
} from "../features/player/watch-request";
import { gateway } from "../lib/bridge";
export function App() {
  const client = useQueryClient();
  const player = usePlayerSnapshot();
  const playerCommandAsync = player.commandAsync;
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null);
  const playing = Boolean(player.snapshot?.active);

  useEffect(() => {
    const watch = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const parsed = WatchTargetSchema.safeParse(event.detail);
      if (!parsed.success) return;
      setWatchTarget(parsed.data);
      void openWatch(parsed.data, { commandAsync: playerCommandAsync }, client).catch(() => {
        // Source errors live in the source query/native snapshot, not fake playback state.
      });
    };
    window.addEventListener(watchRequestEvent, watch);
    return () => window.removeEventListener(watchRequestEvent, watch);
  }, [playerCommandAsync, client]);

  useEffect(() => {
    // Native video is beneath WebKit. Restore the ordinary page surface on exit.
    document.body.classList.toggle("bg-background", !playing);
    return () => document.body.classList.add("bg-background");
  }, [playing]);

  useEffect(() => {
    const clear = () => {
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session" && query.queryKey[0] !== "native",
      });
      client.setQueryData(["session"], null);
    };
    window.addEventListener("nahhasio:signed-out", clear);
    return () => window.removeEventListener("nahhasio:signed-out", clear);
  }, [client]);

  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });

  const watchWork = useQuery({
    queryKey: ["work", player.snapshot?.workId ?? watchTarget?.workId],
    queryFn: ({ signal }) => gateway.work(player.snapshot?.workId ?? watchTarget!.workId, signal),
    enabled:
      playing &&
      player.snapshot?.sourceKind !== "local" &&
      Boolean(player.snapshot?.workId ?? watchTarget),
  });
  const selectedInstallment =
    watchWork.data?.installments.find(
      (installment) =>
        installment.id === (player.snapshot?.installmentId ?? watchTarget?.installmentId),
    ) ?? watchWork.data?.installments[0];
  const episodes =
    player.snapshot?.sourceKind === "local"
      ? undefined
      : selectedInstallment?.episodes.map((episode) => ({
          id: episode.id,
          title: episode.title || `الحلقة ${episode.number}`,
          detail: `الحلقة ${episode.number}`,
          current: episode.id === (player.snapshot?.episodeId ?? watchTarget?.episodeId),
        }));
  if (playing)
    return (
      <PlayerHost
        player={player}
        episodes={episodes}
        sourcePanel={
          <SourceControls
            target={player.snapshot?.sourceKind === "local" ? null : watchTarget}
            player={player}
          />
        }
        onSelectEpisode={(episode) => {
          if (!watchTarget || !selectedInstallment) return;
          const target = {
            ...watchTarget,
            installmentId: selectedInstallment.id,
            episodeId: episode.id,
            title: `${watchWork.data?.titleAr || watchWork.data?.canonicalTitle} · ${episode.title}`,
          };
          setWatchTarget(target);
          void openWatch(target, { commandAsync: playerCommandAsync }, client).catch(() => {});
        }}
      />
    );

  if (session.isLoading)
    return (
      <main className="grid h-dvh place-items-center text-muted-foreground" aria-busy="true">
        جارٍ فتح المكتبة…
      </main>
    );

  if (!session.data) return <Login />;

  return <Library user={session.data.user} />;
}
