import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const mediaKinds = ["poster", "banner", "logo", "profile"] as const;
export type MediaKind = (typeof mediaKinds)[number];

function getMediaDirectory() {
  return resolve(
    process.env.ARCADIA_MEDIA_ROOT ??
      fileURLToPath(new URL("../../web/public/media/uploads", import.meta.url)),
  );
}
const maximumImageBytes = 10 * 1024 * 1024;
const mimeDetails = {
  "image/jpeg": {
    extension: ".jpg",
    signature: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8,
  },
  "image/png": {
    extension: ".png",
    signature: (bytes: Buffer) =>
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  "image/webp": {
    extension: ".webp",
    signature: (bytes: Buffer) =>
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP",
  },
  "image/gif": {
    extension: ".gif",
    signature: (bytes: Buffer) =>
      ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")),
  },
} as const;

function safeSlug(value: string) {
  return (
    value
      .normalize("NFKD")
      .replaceAll(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en")
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 80) || "image"
  );
}

export async function storeMedia(input: {
  dataUrl: string;
  fileName: string;
  assetType: MediaKind;
  ownerName: string;
}) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    input.dataUrl,
  );
  if (!match) throw new Error("Use a valid JPEG, PNG, WebP, or GIF image.");

  const mimeType = match[1] as keyof typeof mimeDetails;
  const encodedImage = match[2];
  if (!encodedImage) throw new Error("The image is empty.");
  const bytes = Buffer.from(encodedImage, "base64");
  const details = mimeDetails[mimeType];
  if (!bytes.length || bytes.length > maximumImageBytes)
    throw new Error("Images must be no larger than 10 MB.");
  if (!details.signature(bytes)) throw new Error("The file contents do not match its image type.");

  const folder = input.assetType === "profile" ? "profiles" : `${input.assetType}s`;
  const name = safeSlug(input.ownerName || basename(input.fileName, extname(input.fileName)));
  const fingerprint = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
  const fileName = `${name}-${input.assetType}-${fingerprint}${details.extension}`;
  const mediaDirectory = getMediaDirectory();
  const directory = resolve(mediaDirectory, folder);
  const destination = resolve(directory, fileName);
  if (relative(mediaDirectory, destination).startsWith(".."))
    throw new Error("Invalid media path.");

  await mkdir(directory, { recursive: true });
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { flag: "wx" });
  await rename(temporary, destination);
  return { relativePath: `/media/uploads/${folder}/${fileName}`, mimeType };
}

export async function removeStoredMedia(relativePath: string | null | undefined) {
  if (!relativePath?.startsWith("/media/uploads/")) return;
  const mediaDirectory = getMediaDirectory();
  const destination = resolve(mediaDirectory, `.${relativePath.slice("/media/uploads".length)}`);
  if (relative(mediaDirectory, destination).startsWith("..")) return;
  await rm(destination, { force: true });
}
