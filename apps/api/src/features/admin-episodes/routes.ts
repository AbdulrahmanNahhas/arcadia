import {
  type AdminEpisode,
  adminEpisodesWriteSchema,
  tmdbApplyInputSchema,
} from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { database } from "../../database";
import { fetchTmdbSeason, type TmdbSeasonEpisode, tmdbConfigured } from "../../integrations/tmdb";
import { assignMediaPath } from "../../media-assign";
import { storeMediaFromUrl } from "../../media-storage";

/**
 * The per-episode editor's API. Unlike `PUT /admin/titles/:id/structure`, which deletes and
 * re-inserts every installment (new ids → playback history and per-episode artwork gone), these
 * routes edit `episodes` rows in place, so watched flags, resume positions and stills survive a
 * title fix. Mounted behind the admin gate in `app.ts`; the audit middleware logs every write.
 */
export const adminEpisodeRoutes = new OpenAPIHono();

type EpisodeRow = {
  id: string;
  number: string | number;
  position: number;
  title: string | null;
  summary: string;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  posterPath: string | null;
};

const episodeColumns = () => database().client`e.id, e.number, e.position, e.title, e.summary,
  e.release_date::text as "releaseDate", e.runtime_minutes as "runtimeMinutes",
  (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
    where x.episode_id=e.id and x.role='poster' and x.is_primary limit 1) as "posterPath"`;

function mapEpisode(row: EpisodeRow): AdminEpisode {
  return {
    id: row.id,
    number: Number(row.number),
    position: row.position,
    title: row.title,
    summary: row.summary,
    releaseDate: row.releaseDate,
    runtimeMinutes: row.runtimeMinutes,
    posterPath: row.posterPath,
  };
}

async function installmentContext(installmentId: string) {
  const [row] = await database().client`
    select i.id, i.title_id as "titleId", i.kind, i.title, t.tmdb_id as "tmdbId",
      t.canonical_title as "titleName",
      (select count(*) from installments sibling
        where sibling.title_id = i.title_id and sibling.kind = 'season'
          and sibling.position < i.position) + 1 as "seasonNumber"
    from installments i join titles t on t.id = i.title_id
    where i.id = ${installmentId}`;
  if (!row) return null;
  return {
    id: String(row.id),
    titleId: String(row.titleId),
    kind: String(row.kind),
    title: String(row.title),
    titleName: String(row.titleName),
    tmdbId: row.tmdbId == null ? null : Number(row.tmdbId),
    seasonNumber: Number(row.seasonNumber),
  };
}

async function listEpisodes(installmentId: string) {
  const rows = await database().client<EpisodeRow[]>`
    select ${episodeColumns()} from episodes e
    where e.installment_id = ${installmentId} order by e.position, e.number`;
  return rows.map(mapEpisode);
}

adminEpisodeRoutes.get("/api/v1/admin/installments/:installmentId/episodes", async (context) => {
  const installmentId = context.req.param("installmentId");
  if (!z.string().uuid().safeParse(installmentId).success) {
    return context.json({ message: "معرّف غير صالح." }, 400);
  }
  const installment = await installmentContext(installmentId);
  if (!installment) return context.json({ message: "لم يُعثر على الموسم." }, 404);
  return context.json({
    installmentId,
    titleId: installment.titleId,
    seasonNumber: installment.seasonNumber,
    tmdbId: installment.tmdbId,
    episodes: await listEpisodes(installmentId),
  });
});

/** An `https://` still is downloaded into the media store; a `/media/...` path is used as is. */
async function resolvePosterPath(value: string, ownerName: string) {
  if (!value.startsWith("https://")) return value;
  const stored = await storeMediaFromUrl({ url: value, assetType: "poster", ownerName });
  const sql = database().client;
  const [existing] = await sql`select path from media_assets where sha256=${stored.sha256}`;
  if (existing) return String(existing.path);
  await sql`insert into media_assets (path, sha256, mime_type, byte_size, width, height, original_filename)
    values (${stored.relativePath}, ${stored.sha256}, ${stored.mimeType}, ${stored.byteSize}, ${stored.width}, ${stored.height}, ${stored.originalFilename})`;
  return stored.relativePath;
}

adminEpisodeRoutes.put("/api/v1/admin/installments/:installmentId/episodes", async (context) => {
  const installmentId = context.req.param("installmentId");
  if (!z.string().uuid().safeParse(installmentId).success) {
    return context.json({ message: "معرّف غير صالح." }, 400);
  }
  const installment = await installmentContext(installmentId);
  if (!installment) return context.json({ message: "لم يُعثر على الموسم." }, 404);
  const parsed = adminEpisodesWriteSchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json({ message: "بيانات الحلقات غير صالحة.", issues: parsed.error.issues }, 400);
  }
  const { episodes, removeIds } = parsed.data;
  const numbers = new Set<number>();
  const positions = new Set<number>();
  for (const episode of episodes) {
    if (numbers.has(episode.number) || positions.has(episode.position)) {
      return context.json({ message: "رقم الحلقة أو ترتيبها مكرّر داخل الموسم." }, 400);
    }
    numbers.add(episode.number);
    positions.add(episode.position);
  }

  const sql = database().client;
  const posterUpdates: Array<{ episodeId: string; path: string | null }> = [];
  await sql.begin(async (transaction) => {
    if (removeIds.length) {
      await transaction`delete from episodes where installment_id=${installmentId} and id in ${transaction(removeIds)}`;
    }
    // Two passes so a reorder never trips the (installment, position)/(installment, number)
    // unique indexes mid-way: park every touched row out of range, then set the final values.
    const existingIds = episodes.flatMap((episode) => (episode.id ? [episode.id] : []));
    if (existingIds.length) {
      await transaction`update episodes set position = position + 100000, number = number + 100000
        where installment_id=${installmentId} and id in ${transaction(existingIds)}`;
    }
    for (const episode of episodes) {
      let episodeId = episode.id ?? null;
      if (episodeId) {
        const [updated] = await transaction`update episodes set
            number=${episode.number}, position=${episode.position}, title=${episode.title},
            summary=${episode.summary}, release_date=${episode.releaseDate},
            runtime_minutes=${episode.runtimeMinutes}, updated_at=now()
          where id=${episodeId} and installment_id=${installmentId} returning id`;
        if (!updated) throw new Error(`الحلقة ${episode.number} لم تعد موجودة.`);
      } else {
        const [created] = await transaction`insert into episodes
            (installment_id, number, position, title, summary, release_date, runtime_minutes)
          values (${installmentId}, ${episode.number}, ${episode.position}, ${episode.title},
            ${episode.summary}, ${episode.releaseDate}, ${episode.runtimeMinutes}) returning id`;
        if (!created) throw new Error("تعذّر إنشاء الحلقة.");
        episodeId = String(created.id);
      }
      if (episode.posterPath !== undefined) {
        posterUpdates.push({ episodeId, path: episode.posterPath });
      }
    }
  });
  // Artwork outside the transaction: it downloads files and purges orphans on its own.
  for (const update of posterUpdates) {
    const path = update.path
      ? await resolvePosterPath(
          update.path,
          `${installment.titleName} ${installment.title} episode`,
        )
      : null;
    await assignMediaPath(sql, path, "poster", { episodeId: update.episodeId });
  }
  return context.json({
    installmentId,
    titleId: installment.titleId,
    seasonNumber: installment.seasonNumber,
    tmdbId: installment.tmdbId,
    episodes: await listEpisodes(installmentId),
  });
});

/** Arabic first, English for whatever TMDB has not localised. */
async function fetchSeasonBilingual(tmdbId: number, season: number) {
  const [arabic, english] = await Promise.all([
    fetchTmdbSeason({ tmdbId, season, language: "ar-SA" }),
    fetchTmdbSeason({ tmdbId, season, language: "en-US" }),
  ]);
  if (!english && !arabic) return null;
  const byNumber = new Map<number, TmdbSeasonEpisode>();
  for (const episode of english ?? []) byNumber.set(episode.number, episode);
  for (const episode of arabic ?? []) {
    const base = byNumber.get(episode.number);
    byNumber.set(episode.number, {
      ...(base ?? episode),
      title: episode.title ?? base?.title ?? null,
      summary: episode.summary || base?.summary || "",
    });
  }
  return [...byNumber.values()].toSorted((a, b) => a.number - b.number);
}

adminEpisodeRoutes.get(
  "/api/v1/admin/installments/:installmentId/episodes/tmdb",
  async (context) => {
    const installmentId = context.req.param("installmentId");
    const installment = await installmentContext(installmentId);
    if (!installment) return context.json({ message: "لم يُعثر على الموسم." }, 404);
    if (!tmdbConfigured()) {
      return context.json({ message: "لم يُضبط مفتاح TMDB في هذا التثبيت." }, 503);
    }
    if (installment.tmdbId === null) {
      return context.json(
        { message: "العنوان لا يحمل معرّف TMDB بعد — أضفه أولاً من النموذج." },
        409,
      );
    }
    const requested = Number(context.req.query("season") ?? installment.seasonNumber);
    const season =
      Number.isInteger(requested) && requested >= 0 ? requested : installment.seasonNumber;
    const fetched = await fetchSeasonBilingual(installment.tmdbId, season);
    if (!fetched)
      return context.json({ message: "تعذّر الوصول إلى TMDB أو الموسم غير موجود." }, 502);
    const existing = await listEpisodes(installmentId);
    const byNumber = new Map(existing.map((episode) => [episode.number, episode.id]));
    return context.json({
      tmdbId: installment.tmdbId,
      season,
      episodes: fetched.map((episode) => ({
        ...episode,
        existingId: byNumber.get(episode.number) ?? null,
      })),
    });
  },
);

adminEpisodeRoutes.post(
  "/api/v1/admin/installments/:installmentId/episodes/tmdb",
  async (context) => {
    const installmentId = context.req.param("installmentId");
    const installment = await installmentContext(installmentId);
    if (!installment) return context.json({ message: "لم يُعثر على الموسم." }, 404);
    if (!tmdbConfigured()) {
      return context.json({ message: "لم يُضبط مفتاح TMDB في هذا التثبيت." }, 503);
    }
    if (installment.tmdbId === null) {
      return context.json({ message: "العنوان لا يحمل معرّف TMDB بعد." }, 409);
    }
    const parsed = tmdbApplyInputSchema.safeParse(await context.req.json());
    if (!parsed.success) return context.json({ message: "خيارات غير صالحة." }, 400);
    const { mode, stills, createMissing } = parsed.data;
    const season = parsed.data.season ?? installment.seasonNumber;
    const fetched = await fetchSeasonBilingual(installment.tmdbId, season);
    if (!fetched)
      return context.json({ message: "تعذّر الوصول إلى TMDB أو الموسم غير موجود." }, 502);

    const sql = database().client;
    const existing = await listEpisodes(installmentId);
    const byNumber = new Map(existing.map((episode) => [episode.number, episode]));
    let nextPosition = existing.reduce((max, episode) => Math.max(max, episode.position), 0) + 1;
    const stillsToAssign: Array<{ episodeId: string; url: string }> = [];
    let updated = 0;
    let created = 0;

    await sql.begin(async (transaction) => {
      for (const remote of fetched) {
        const current = byNumber.get(remote.number);
        if (current) {
          const next = {
            title:
              mode === "overwrite"
                ? (remote.title ?? current.title)
                : current.title || remote.title,
            summary:
              mode === "overwrite"
                ? remote.summary || current.summary
                : current.summary || remote.summary,
            releaseDate:
              mode === "overwrite"
                ? (remote.releaseDate ?? current.releaseDate)
                : (current.releaseDate ?? remote.releaseDate),
            runtimeMinutes:
              mode === "overwrite"
                ? (remote.runtimeMinutes ?? current.runtimeMinutes)
                : (current.runtimeMinutes ?? remote.runtimeMinutes),
          };
          await transaction`update episodes set title=${next.title}, summary=${next.summary},
              release_date=${next.releaseDate}, runtime_minutes=${next.runtimeMinutes}, updated_at=now()
            where id=${current.id}`;
          updated += 1;
          if (stills && remote.stillUrl && (!current.posterPath || mode === "overwrite")) {
            stillsToAssign.push({ episodeId: current.id, url: remote.stillUrl });
          }
        } else if (createMissing) {
          const [row] = await transaction`insert into episodes
              (installment_id, number, position, title, summary, release_date, runtime_minutes)
            values (${installmentId}, ${remote.number}, ${nextPosition}, ${remote.title},
              ${remote.summary}, ${remote.releaseDate}, ${remote.runtimeMinutes}) returning id`;
          nextPosition += 1;
          created += 1;
          if (row && stills && remote.stillUrl) {
            stillsToAssign.push({ episodeId: String(row.id), url: remote.stillUrl });
          }
        }
      }
    });

    let stillsSaved = 0;
    for (const still of stillsToAssign) {
      try {
        const path = await resolvePosterPath(
          still.url,
          `${installment.titleName} ${installment.title} episode`,
        );
        await assignMediaPath(sql, path, "poster", { episodeId: still.episodeId });
        stillsSaved += 1;
      } catch (error) {
        console.warn(`TMDB still for episode ${still.episodeId} failed`, error);
      }
    }
    return context.json({
      installmentId,
      titleId: installment.titleId,
      seasonNumber: installment.seasonNumber,
      tmdbId: installment.tmdbId,
      applied: { updated, created, stillsSaved, fetched: fetched.length },
      episodes: await listEpisodes(installmentId),
    });
  },
);
