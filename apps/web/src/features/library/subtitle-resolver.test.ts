import type { InstallmentSubtitles } from "@arcadia/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadInstallmentSubtitle, getInstallmentSubtitles } from "./subtitle-resolver";

afterEach(() => {
  vi.unstubAllGlobals();
});

const response: InstallmentSubtitles = {
  installmentId: "11111111-1111-1111-1111-111111111111",
  titleId: "22222222-2222-2222-2222-222222222222",
  candidates: [
    {
      fileId: 1,
      fileName: "some.ar.srt",
      language: "ar",
      release: null,
      downloadCount: 5,
      matchedBy: "hash",
    },
  ],
};

describe("getInstallmentSubtitles", () => {
  it("builds a query string from the optional matching hints", async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getInstallmentSubtitles(response.installmentId, {
      episodeId: "33333333-3333-3333-3333-333333333333",
      videoHash: "abc123",
    });

    expect(result).toEqual(response);
    const url = fetchMock.mock.calls[0]?.[0] ?? "";
    expect(url).toContain(`/installments/${response.installmentId}/subtitles?`);
    expect(url).toContain("episodeId=33333333");
    expect(url).toContain("videoHash=abc123");
  });

  it("sends no query string when nothing is known yet", async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getInstallmentSubtitles(response.installmentId);

    const url = fetchMock.mock.calls[0]?.[0] ?? "";
    expect(url.endsWith("/subtitles")).toBe(true);
  });
});

describe("downloadInstallmentSubtitle", () => {
  it("returns the bytes and the filename from Content-Disposition", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytes, {
            status: 200,
            headers: { "Content-Disposition": 'attachment; filename="some.ar.srt"' },
          }),
      ),
    );

    const file = await downloadInstallmentSubtitle(response.installmentId, 1);
    expect(file.filename).toBe("some.ar.srt");
    expect([...file.bytes]).toEqual([1, 2, 3]);
  });

  it("falls back to a generic filename when the header is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })),
    );

    const file = await downloadInstallmentSubtitle(response.installmentId, 7);
    expect(file.filename).toBe("subtitle-7.srt");
  });

  it("throws when the download fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 502 })),
    );

    await expect(downloadInstallmentSubtitle(response.installmentId, 1)).rejects.toThrow();
  });
});
