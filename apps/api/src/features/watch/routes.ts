import { watchStreamsQuerySchema } from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import {
  downloadSubtitleFile,
  fetchSubtitleCandidates,
  subtitleSourceConfigured,
} from "../../integrations/opensubtitles";
import { fetchStreamCandidates, streamSourceConfigured } from "../../integrations/torrent-source";
import { currentFamilyAccount } from "../accounts/routes";

/**
 * The watch hub (`/watch` in the web app): play anything by IMDb id, outside the catalog. No
 * title, no artwork, no progress — just the same ranked sources and subtitle search the catalog
 * player uses, keyed by `tt…` (+ season/episode for series).
 *
 * Owner/editor only: the catalog's family-safety classification cannot apply to an arbitrary id,
 * so a restricted profile must not be able to route around it here. Widen `allowed` below if a
 * specific family member should have it.
 */
export const watchRoutes = new OpenAPIHono();

const allowed = new Set(["owner", "editor"]);

async function watcher(headers: Headers) {
  const current = await currentFamilyAccount(headers);
  if (!current) return { error: { status: 401 as const, message: "الحساب غير متاح." } };
  if (!allowed.has(current.account.role)) {
    return {
      error: {
        status: 403 as const,
        code: "not_permitted" as const,
        message: "مركز المشاهدة متاح لحسابات الإدارة فقط.",
      },
    };
  }
  return { current };
}

watchRoutes.get("/api/v1/watch/streams", async (context) => {
  const gate = await watcher(context.req.raw.headers);
  if (gate.error) return context.json(gate.error, gate.error.status);
  const parsed = watchStreamsQuerySchema.safeParse(context.req.query());
  if (!parsed.success) {
    return context.json({ code: "no_identifier" as const, message: "معرّف IMDb غير صالح." }, 400);
  }
  if (!streamSourceConfigured()) {
    return context.json(
      { code: "source_not_configured" as const, message: "لم يُضبط مصدر البث في هذا التثبيت." },
      503,
    );
  }
  const { imdbId, season, episode } = parsed.data;
  const series = season !== undefined && episode !== undefined;
  const streamId = series ? `${imdbId}:${season}:${episode}` : imdbId;
  const candidates = await fetchStreamCandidates({
    type: series ? "series" : "movie",
    id: streamId,
    preferredAudio: gate.current.account.preferences.preferredAudio,
  });
  if (!candidates) {
    return context.json(
      { code: "source_unavailable" as const, message: "تعذّر الوصول إلى مصدر البث." },
      502,
    );
  }
  return context.json({ streamId, candidates }, 200);
});

const subtitlesQuerySchema = watchStreamsQuerySchema.extend({
  videoHash: z.string().optional(),
  languages: z.string().optional(),
});

watchRoutes.get("/api/v1/watch/subtitles", async (context) => {
  const gate = await watcher(context.req.raw.headers);
  if (gate.error) return context.json(gate.error, gate.error.status);
  const parsed = subtitlesQuerySchema.safeParse(context.req.query());
  if (!parsed.success) {
    return context.json({ code: "no_identifier" as const, message: "معرّف IMDb غير صالح." }, 400);
  }
  if (!subtitleSourceConfigured()) {
    return context.json(
      { code: "source_not_configured" as const, message: "لم يُضبط مصدر الترجمة في هذا التثبيت." },
      503,
    );
  }
  const { imdbId, season, episode, videoHash, languages } = parsed.data;
  const candidates = await fetchSubtitleCandidates({
    imdbId,
    season: season ?? null,
    episode: episode ?? null,
    videoHash: videoHash ?? null,
    videoSize: null,
    languages:
      languages === "all"
        ? []
        : languages
          ? languages.split(",").map((value: string) => value.trim())
          : ["ar", "en"],
  });
  if (!candidates) {
    return context.json(
      { code: "source_unavailable" as const, message: "تعذّر الوصول إلى مصدر الترجمة." },
      502,
    );
  }
  return context.json({ candidates }, 200);
});

watchRoutes.get("/api/v1/watch/subtitles/:fileId/download", async (context) => {
  const gate = await watcher(context.req.raw.headers);
  if (gate.error) return context.json(gate.error, gate.error.status);
  const fileId = Number(context.req.param("fileId"));
  if (!Number.isInteger(fileId)) {
    return context.json({ code: "not_found" as const, message: "ملف ترجمة غير معروف." }, 404);
  }
  if (!subtitleSourceConfigured()) {
    return context.json(
      { code: "source_not_configured" as const, message: "لم يُضبط مصدر الترجمة في هذا التثبيت." },
      503,
    );
  }
  const file = await downloadSubtitleFile(fileId);
  if (!file) {
    return context.json(
      { code: "source_unavailable" as const, message: "تعذّر تنزيل ملف الترجمة." },
      502,
    );
  }
  return new Response(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.fileName ?? `subtitle-${fileId}.srt`}"`,
    },
  });
});
