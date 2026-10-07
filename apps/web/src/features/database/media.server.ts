import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { getPublicMediaDirectory } from "@arcadia/api/media-storage";
import { z } from "zod";

import { pageSchema } from "./database-model";
import { databaseRequest, requireLocalAdmin } from "./database.server";

export async function mediaResponse(path: string) {
  requireLocalAdmin();
  const root = getPublicMediaDirectory();
  const file = resolve(root, path);
  if (!file.startsWith(root + sep)) return new Response("Not found", { status: 404 });
  const page = pageSchema.parse(
    await databaseRequest(
      `media_assets?filters=${encodeURIComponent(JSON.stringify({ path: `/media/${path}` }))}`,
    ),
  );
  const asset = page.rows[0];
  if (!asset) return new Response("Not found", { status: 404 });
  const mime = z
    .enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
    .parse(asset.mime_type);
  try {
    const bytes = await readFile(file);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": mime,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
