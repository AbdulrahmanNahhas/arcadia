import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { removeStoredMedia, storeMedia } from "./media-storage";

const tinyPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

afterEach(() => {
  delete process.env.ARCADIA_MEDIA_ROOT;
});

describe("media storage", () => {
  it("stores an image in its media folder with a safe, descriptive name", async () => {
    const root = await mkdtemp(join(tmpdir(), "arcadia-media-"));
    process.env.ARCADIA_MEDIA_ROOT = root;

    const stored = await storeMedia({
      dataUrl: `data:image/png;base64,${tinyPng.toString("base64")}`,
      fileName: "../../../unsafe.png",
      ownerName: "SAKAMOTO DAYS: Season 2 / Part 2",
      assetType: "poster",
    });

    expect(stored.relativePath).toMatch(
      /^\/media\/uploads\/posters\/sakamoto-days-season-2-part-2-poster-[a-f0-9]{10}\.png$/,
    );
    const diskPath = join(root, stored.relativePath.replace("/media/uploads/", ""));
    expect(await readFile(diskPath)).toEqual(tinyPng);

    await removeStoredMedia(stored.relativePath);
    await expect(readFile(diskPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects an image whose declared type does not match its bytes", async () => {
    process.env.ARCADIA_MEDIA_ROOT = await mkdtemp(join(tmpdir(), "arcadia-media-"));
    await expect(
      storeMedia({
        dataUrl: `data:image/jpeg;base64,${tinyPng.toString("base64")}`,
        fileName: "poster.jpg",
        ownerName: "Example",
        assetType: "poster",
      }),
    ).rejects.toThrow("do not match");
  });
});
