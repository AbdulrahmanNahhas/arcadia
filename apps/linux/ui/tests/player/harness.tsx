import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import {
  PlayerHost,
  PlayerRequestSchema,
  PlayerSnapshotSchema,
  usePlayerSnapshot,
} from "../../src/features/player";

import "../../src/styles/tailwind.css";

type PlayerBoundaryInput = Parameters<typeof PlayerRequestSchema.safeParse>[0];

declare global {
  interface Window {
    playerValidation: {
      request: (value: PlayerBoundaryInput) => boolean;
      snapshot: (value: PlayerBoundaryInput) => boolean;
    };
  }
}
window.playerValidation = {
  request: (value) => PlayerRequestSchema.safeParse(value).success,
  snapshot: (value) => PlayerSnapshotSchema.safeParse(value).success,
};

function Harness() {
  const player = usePlayerSnapshot();
  return (
    <>
      <PlayerHost player={player} />
      {!player.snapshot?.active && (
        <button onClick={() => player.command({ command: "player.pickVideo", payload: {} })}>
          Open test video
        </button>
      )}
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing test root");
createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <Harness />
  </QueryClientProvider>,
);
