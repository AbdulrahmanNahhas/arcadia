import { createHash } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const mediaKinds = ["poster", "banner", "logo", "profile"] as const;
export type MediaKind = (typeof mediaKinds)[number];

function getMediaDirectory() {
  return resolve(
    process.env.ARCADIA_MEDIA_ROOT ??
      fileURLToPath(new URL("../../web/public/media/uploads", import.meta.url)),
  );
}
function getPublicMediaDirectory() {
  return resolve(
    process.env.ARCADIA_PUBLIC_MEDIA_ROOT ??
      (process.env.ARCADIA_MEDIA_ROOT
        ? dirname(getMediaDirectory())
        : fileURLToPath(new URL("../../web/public/media", import.meta.url))),
  );
}

function resolvePublicMediaPath(publicPath: string) {
  if (!publicPath.startsWith("/media/")) return null;
  const root = getPublicMediaDirectory();
  const destination = resolve(root, `.${publicPath.slice("/media".length)}`);
  const pathFromRoot = relative(root, destination);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) return null;
  return destination;
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

function imageDimensions(bytes: Buffer, mimeType: keyof typeof mimeDetails) {
  if (mimeType === "image/png" && bytes.length >= 24)
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (mimeType === "image/gif" && bytes.length >= 10)
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const kind = bytes.subarray(12, 16).toString("ascii");
    if (kind === "VP8 ") {
      const frame = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
      if (frame >= 0 && frame + 7 <= bytes.length)
        return {
          width: bytes.readUInt16LE(frame + 3) & 0x3fff,
          height: bytes.readUInt16LE(frame + 5) & 0x3fff,
        };
    }
    if (kind === "VP8X")
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
      };
    if (kind === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset++;
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      if (offset >= bytes.length) break;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0xd9 || (marker && marker >= 0xd0 && marker <= 0xd7))
        continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      const isStartOfFrame =
        marker &&
        ((marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf));
      if (isStartOfFrame && length >= 7)
        return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      offset += length;
    }
  }
  throw new Error("Could not read image dimensions.");
}

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
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fingerprint = sha256.slice(0, 10);
  const dimensions = imageDimensions(bytes, mimeType);
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
  return {
    relativePath: `/media/uploads/${folder}/${fileName}`,
    mimeType,
    sha256,
    byteSize: bytes.byteLength,
    ...dimensions,
    originalFilename: basename(input.fileName),
  };
}

export async function removeStoredMedia(relativePath: string | null | undefined) {
  if (!relativePath?.startsWith("/media/uploads/")) return;
  const mediaDirectory = getMediaDirectory();
  const destination = resolve(mediaDirectory, `.${relativePath.slice("/media/uploads".length)}`);
  if (relative(mediaDirectory, destination).startsWith("..")) return;
  await rm(destination, { force: true });
}

export async function storedMediaExists(relativePath: string) {
  const destination = resolvePublicMediaPath(relativePath);
  if (!destination) return false;
  try {
    await access(destination);
    return true;
  } catch {
    return false;
  }
}
