import { describe, expect, it } from "vitest";
import {
  findEpisode,
  nextUnwatchedEpisode,
  type PlayerEpisodeSource,
  type PlayerTitleSource,
  playerSeasons,
} from "./episodes";

function episode(id: string, number: number): PlayerEpisodeSource {
  return {
    id,
    number,
    position: number,
    title: null,
    summary: "",
    releaseDate: "2020-01-01",
    runtimeMinutes: 22,
    posterPath: null,
  };
}

function season(
  id: string,
  position: number,
  episodes: PlayerEpisodeSource[],
): PlayerTitleSource["installments"][number] {
  return {
    id,
    kind: "season",
    position,
    title: `Season ${position}`,
    status: "completed",
    episodes,
    isPlayable: true,
  };
}

const title: PlayerTitleSource = {
  imdbId: "tt1",
  tmdbId: null,
  installments: [
    season("s2", 2, [episode("e3", 1)]),
    season("s1", 1, [episode("e1", 1), episode("e2", 2)]),
  ],
};

describe("playerSeasons", () => {
  it("orders seasons and numbers them from one", () => {
    const seasons = playerSeasons(title, []);
    expect(seasons.map((entry) => [entry.installmentId, entry.seasonNumber])).toEqual([
      ["s1", 1],
      ["s2", 2],
    ]);
  });

  it("marks watched episodes from playback state", () => {
    const seasons = playerSeasons(title, [{ episodeId: "e1", isPlayed: true }]);
    expect(findEpisode(seasons, "s1", "e1")?.played).toBe(true);
    expect(findEpisode(seasons, "s1", "e2")?.played).toBe(false);
  });
});

describe("nextUnwatchedEpisode", () => {
  it("crosses a season boundary and skips watched episodes", () => {
    const seasons = playerSeasons(title, [{ episodeId: "e2", isPlayed: true }]);
    expect(nextUnwatchedEpisode(seasons, "s1", "e1")?.episodeId).toBe("e3");
    expect(nextUnwatchedEpisode(seasons, "s2", "e3")).toBeNull();
  });

  it("is null for a movie", () => {
    expect(nextUnwatchedEpisode(playerSeasons(title, []), "s1", null)).toBeNull();
  });
});
