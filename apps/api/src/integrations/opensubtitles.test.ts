import { afterEach, describe, expect, it } from "vitest";
import { fetchSubtitleCandidates, sanitizeSubtitleBytes } from "./opensubtitles";

/**
 * Coverage for the pure functions in this integration worth unit-testing directly — the route
 * tests in `apps/api/src/features/titles/subtitles.test.ts` cover the HTTP-boundary behaviour
 * (visibility, id resolution, error codes) by stubbing `fetch` the same way.
 */

afterEach(() => {
  delete process.env.OPENSUBTITLES_API_KEY;
});

describe("fetchSubtitleCandidates", () => {
  it("drops a result whose language wasn't actually requested", async () => {
    process.env.OPENSUBTITLES_API_KEY = "test-key";
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload this test exercises (a single URL argument
    // returning a Response), which is all the code under test calls.
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { attributes: { language: "ar", files: [{ file_id: 1, file_name: "a.srt" }] } },
            { attributes: { language: "fr", files: [{ file_id: 2, file_name: "b.srt" }] } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof globalThis.fetch;
    try {
      const candidates = await fetchSubtitleCandidates({
        imdbId: "tt0133093",
        season: null,
        episode: null,
        videoHash: null,
        videoSize: null,
        languages: ["ar", "en"],
      });
      expect(candidates?.map((candidate) => candidate.language)).toEqual(["ar"]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("ranks Arabic ahead of English even when English has the accurate hash match", async () => {
    process.env.OPENSUBTITLES_API_KEY = "test-key";
    const original = globalThis.fetch;
    // SAFETY: see the SAFETY note on the test above — same stub shape.
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              attributes: {
                language: "en",
                moviehash_match: true,
                files: [{ file_id: 1, file_name: "en.srt" }],
              },
            },
            {
              attributes: {
                language: "ar",
                moviehash_match: false,
                files: [{ file_id: 2, file_name: "ar.srt" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof globalThis.fetch;
    try {
      const candidates = await fetchSubtitleCandidates({
        imdbId: "tt0133093",
        season: null,
        episode: null,
        videoHash: "abc123",
        videoSize: null,
        languages: ["ar", "en"],
      });
      expect(candidates?.map((candidate) => candidate.language)).toEqual(["ar", "en"]);
    } finally {
      globalThis.fetch = original;
    }
  });
});
describe("sanitizeSubtitleBytes", () => {
  function decode(bytes: Uint8Array) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  it("replaces the bidi mark entities with the real Unicode characters", () => {
    const input = new TextEncoder().encode("&rlm;مرحباً&lrm; World");
    const output = decode(sanitizeSubtitleBytes(input));
    expect(output).toBe("‏مرحباً‎ World");
  });

  it("decodes the other common stray HTML entities", () => {
    const input = new TextEncoder().encode(
      "Tom &amp; Jerry &lt;3 &nbsp;&quot;fun&quot;&#39;s&#39;",
    );
    const output = decode(sanitizeSubtitleBytes(input));
    expect(output).toBe("Tom & Jerry <3  \"fun\"'s'");
  });

  it("leaves ordinary subtitle text untouched", () => {
    const input = new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\nHello there.\n");
    expect(decode(sanitizeSubtitleBytes(input))).toBe(decode(input));
  });
});
