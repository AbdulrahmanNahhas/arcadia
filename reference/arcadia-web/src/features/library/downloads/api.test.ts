import { describe, expect, it } from "vitest";
import { type DownloadItem, downloadStateLabel, findDownload, formatRate } from "./api";

const base: DownloadItem = {
  id: "d1",
  titleId: "t",
  titleName: "Spirited Away",
  installmentId: "i1",
  episodeId: null,
  label: "الفيلم",
  infoHash: "a".repeat(40),
  fileIdx: 0,
  magnet: "magnet:?xt=urn:btih:aaaa",
  path: "/home/family/Videos/Arcadia/Spirited Away/film.mkv",
  folder: "/home/family/Videos/Arcadia/Spirited Away",
  sizeBytes: 100,
  downloadedBytes: 50,
  downloadRateBps: 0,
  peersConnected: 0,
  state: "downloading",
  error: null,
  subtitles: [],
  createdAtMs: 1,
  completedAtMs: null,
};

describe("findDownload", () => {
  it("matches a film by installment with no episode", () => {
    expect(findDownload([base], "i1", null)?.id).toBe("d1");
    expect(findDownload([base], "i1", "e1")).toBeNull();
  });

  it("matches an episode only with its exact episode id", () => {
    const episode = { ...base, id: "d2", episodeId: "e1" };
    expect(findDownload([base, episode], "i1", "e1")?.id).toBe("d2");
    expect(findDownload([episode], "i1", null)).toBeNull();
  });
});

describe("labels", () => {
  it("names every state in Arabic", () => {
    expect(downloadStateLabel("completed")).toContain("متاح دون اتصال");
    expect(downloadStateLabel("queued")).toBe("في الانتظار");
  });

  it("formats rates in MB/s above a megabyte and KB/s below", () => {
    expect(formatRate(2.5 * 1024 ** 2)).toBe("2.5 م.ب/ث");
    expect(formatRate(512 * 1024)).toBe("512 ك.ب/ث");
  });
});
