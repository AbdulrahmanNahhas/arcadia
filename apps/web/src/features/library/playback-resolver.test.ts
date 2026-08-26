import type { InstallmentStreams, StreamError } from "@arcadia/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { messageFor, PlaybackError, resolvePlayback } from "./playback-resolver";

function stubFetch(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

function jsonResponse(body: InstallmentStreams | StreamError, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Runs the resolver and returns the `PlaybackError` it rejected with. */
async function failureOf(installmentId: string): Promise<PlaybackError> {
  try {
    await resolvePlayback(installmentId);
  } catch (error) {
    if (error instanceof PlaybackError) return error;
    throw error;
  }
  throw new Error("expected resolvePlayback to reject");
}

const candidate: InstallmentStreams["candidates"][number] = {
  id: `${"a".repeat(40)}:0`,
  kind: "torrent",
  label: "NahhasArcadia · 1080p",
  description: null,
  infoHash: "a".repeat(40),
  fileIdx: 0,
  url: null,
  filename: "The.Matrix.mkv",
  trackers: ["udp://tracker.example:1337/announce"],
  bingeGroup: null,
  videoSize: null,
  videoHash: null,
  quality: "1080p",
  height: 1080,
  seeders: 100,
  sizeBytes: 2_000_000_000,
  provider: "YTS",
  isEnglish: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("resolvePlayback", () => {
  it("returns a torrent source when the API offers info-hash candidates", async () => {
    stubFetch(
      jsonResponse({
        installmentId: "11111111-1111-1111-1111-111111111111",
        titleId: "22222222-2222-2222-2222-222222222222",
        streamId: "tt0133093",
        idSource: "installment.imdb",
        candidates: [candidate],
      }),
    );
    const source = await resolvePlayback("11111111-1111-1111-1111-111111111111");
    expect(source.kind).toBe("torrent");
    expect(source.streams.candidates).toHaveLength(1);
  });

  it("reports a debrid source when every candidate is already a direct URL", async () => {
    stubFetch(
      jsonResponse({
        installmentId: "11111111-1111-1111-1111-111111111111",
        titleId: "22222222-2222-2222-2222-222222222222",
        streamId: "tt0133093",
        idSource: "installment.imdb",
        candidates: [
          {
            ...candidate,
            id: "direct:abc",
            kind: "direct",
            infoHash: null,
            fileIdx: null,
            url: "https://debrid.example/file.mkv",
          },
        ],
      }),
    );
    expect((await resolvePlayback("11111111-1111-1111-1111-111111111111")).kind).toBe("debrid");
  });

  it("separates an addon with nothing to offer from every other failure", async () => {
    stubFetch(
      jsonResponse({
        installmentId: "11111111-1111-1111-1111-111111111111",
        titleId: "22222222-2222-2222-2222-222222222222",
        streamId: "tt0133093",
        idSource: "installment.imdb",
        candidates: [],
      }),
    );
    await expect(resolvePlayback("11111111-1111-1111-1111-111111111111")).rejects.toMatchObject({
      failure: "no_streams",
    });
  });

  it.each([
    ["no_identifier", 409],
    ["not_permitted", 403],
    ["unsupported_kind", 400],
    ["source_unavailable", 502],
    ["source_not_configured", 503],
  ] as const)("carries the API's %s code through to the UI", async (code, status) => {
    stubFetch(jsonResponse({ code, message: "رسالة من الخادم" }, status));
    const error = await failureOf("11111111-1111-1111-1111-111111111111");
    expect(error.failure).toBe(code);
    expect(error.message).toBe("رسالة من الخادم");
  });

  it("falls back to a generic failure when the API sends no recognisable code", async () => {
    stubFetch(
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const error = await failureOf("11111111-1111-1111-1111-111111111111");
    expect(error.failure).toBe("unknown");
    expect(error.message).toBe(messageFor("unknown"));
  });
});

describe("ApiError", () => {
  it("keeps the structured code so callers never match on Arabic prose", () => {
    const error = new ApiError("رسالة", 409, undefined, "no_identifier");
    expect(error.code).toBe("no_identifier");
    expect(error).toBeInstanceOf(Error);
  });
});
