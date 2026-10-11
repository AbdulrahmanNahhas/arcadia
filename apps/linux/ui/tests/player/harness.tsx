import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  PlayerHost,
  PlayerRequestSchema,
  PlayerSnapshotSchema,
  usePlayerSnapshot,
  type PlayerEpisode,
} from "../../src/features/player";
import { openWatch } from "../../src/features/player/playback";
import { episodeNumberLabel } from "../../src/features/work/format";

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

const target = {
  workId: "00000000-0000-4000-8000-000000000001",
  installmentId: "00000000-0000-4000-8000-000000000002",
  title: "فيديو الاختبار المحلي",
};
const episodes: PlayerEpisode[] = Array.from({ length: 12 }, (_, index) => ({
  id: `episode-${index + 1}`,
  number: `${index + 1}.00`,
  title: `عنوان الحلقة ${index + 1}`,
  detail: `الحلقة ${episodeNumberLabel(`${index + 1}.00`)}`,
  summary:
    "ملخص تجريبي لهذه الحلقة لاختبار وضوح النص وقراءة الملخص كاملًا، مع الحفاظ على ترتيب الحلقات والتنقل بلوحة المفاتيح.",
  runtimeMinutes: 24,
  current: index === 4,
  disabled: index === 11,
  disabledReason: "قادم",
  image: {
    id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    url: "",
    role: "banner",
    isPrimary: true,
    mimeType: "image/png",
    width: 320,
    height: 180,
    byteSize: 1,
    sha256: "synthetic-artwork",
    originalFilename: "synthetic.png",
    focalX: 50,
    focalY: 50,
  },
}));

function Harness() {
  const player = usePlayerSnapshot();
  const client = useQueryClient();
  const scenario = new URLSearchParams(window.location.search).get("scenario");
  const [selected, setSelected] = useState<string | null>(null);
  const [watchOpened, setWatchOpened] = useState(false);
  return (
    <>
      <PlayerHost
        player={player}
        episodes={scenario === "episodes" ? episodes : undefined}
        installmentTitle="الموسم الأول"
        onSelectEpisode={(episode) => setSelected(episode.id)}
        sourceTarget={
          scenario === "download"
            ? { ...target, intent: "download" }
            : scenario === "sources" || watchOpened
              ? target
              : null
        }
      />
      {selected && <output aria-label="الحلقة المختارة">{selected}</output>}
      {!player.snapshot?.active && (
        <>
          <button onClick={() => player.command({ command: "player.pickVideo", payload: {} })}>
            Open test video
          </button>
          <button
            onClick={() => {
              setWatchOpened(true);
              void openWatch(target, player, client).catch(() => {});
            }}
          >
            Watch test work
          </button>
        </>
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
