import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gateway } from "../../lib/bridge";
import type { WatchedSelection } from "../../lib/bridge";

export const workStateKey = (id: string) => ["viewer", "work", id] as const;

export function useWorkTracking(id: string) {
  const client = useQueryClient();
  const state = useQuery({
    queryKey: workStateKey(id),
    queryFn: ({ signal }) => gateway.workState(id, signal),
  });
  const refresh = async (next: Awaited<ReturnType<typeof gateway.workState>>) => {
    await client.cancelQueries({ queryKey: workStateKey(id) });
    client.setQueryData(workStateKey(id), next);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["catalog"] }),
      client.invalidateQueries({ queryKey: ["home"] }),
    ]);
  };
  const favorite = useMutation({
    mutationFn: (isFavorite: boolean) => gateway.setFavorite(id, isFavorite),
    onSuccess: refresh,
  });
  const watched = useMutation({
    mutationFn: (selection: WatchedSelection) => gateway.setWatched(id, selection),
    onSuccess: refresh,
  });
  return {
    state,
    favorite,
    watched,
    pending: favorite.isPending || watched.isPending,
    error: watched.error ?? favorite.error,
  };
}
export type WorkTracking = ReturnType<typeof useWorkTracking>;
