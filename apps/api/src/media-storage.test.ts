import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { removeStoredMedia, storedMediaExists, storeMedia } from "./media-storage";

const tinyPng = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
]);

afterEach(() => {
  delete process.env.ARCADIA_MEDIA_ROOT;
  delete process.env.ARCADIA_PUBLIC_MEDIA_ROOT;
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
    expect(stored).toMatchObject({ width: 1, height: 1, byteSize: tinyPng.byteLength });
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

  it("reads dimensions from common lossy WebP images", async () => {
    process.env.ARCADIA_MEDIA_ROOT = await mkdtemp(join(tmpdir(), "arcadia-media-"));
    const webp = Buffer.alloc(30);
    webp.write("RIFF", 0, "ascii");
    webp.write("WEBP", 8, "ascii");
    webp.write("VP8 ", 12, "ascii");
    webp.set([0x9d, 0x01, 0x2a], 20);
    webp.writeUInt16LE(640, 23);
    webp.writeUInt16LE(360, 25);
    const stored = await storeMedia({
      dataUrl: `data:image/webp;base64,${webp.toString("base64")}`,
      fileName: "banner.webp",
      ownerName: "Example",
      assetType: "banner",
    });
    expect(stored).toMatchObject({ width: 640, height: 360 });
  });

  it("finds retained library assets outside the managed uploads folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "arcadia-public-media-"));
    process.env.ARCADIA_PUBLIC_MEDIA_ROOT = root;
    const directory = join(root, "library");
    await mkdir(directory);
    await writeFile(join(directory, "visible-poster.png"), tinyPng);

    await expect(storedMediaExists("/media/library/visible-poster.png")).resolves.toBe(true);
    await expect(storedMediaExists("/media/library/missing.png")).resolves.toBe(false);
    await expect(storedMediaExists("/media/../secret.png")).resolves.toBe(false);
  });
});
