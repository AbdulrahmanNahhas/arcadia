import type postgres from "postgres";
import type { z } from "zod";
import type { adminStructureSchema } from "../../app";
import { database } from "../../database";
import {
  assignMediaPath,
  materializeEmbeddedMedia,
  purgeUnreferencedMedia,
} from "../../media-assign";

type StructureInput = z.infer<typeof adminStructureSchema>;
type SeasonInput = StructureInput["seasons"][number];
type UnitInput = SeasonInput["units"][number];

/**
 * Saves a title's installments and episodes **in place**.
 *
 * The previous implementation deleted every installment and re-inserted the document, which
 * gave every season and episode a new id on every save — and `account_playback_states`,
 * `account_downloads`, per-episode artwork and award links all cascade on those ids. Setting a
 * season poster in the editor form wiped the family's watch progress for the whole title.
 *
 * Rows are matched by the ids the document carries (the editor always sends them); a row without
 * a known id is inserted; rows of this title absent from the document are deleted — the one
 * place removal is still explicit and intended. Positions/numbers are parked out of range first
 * so a reorder never collides with the unique indexes mid-way.
 */
export async function saveTitleStructure(titleId: string, input: StructureInput): Promise<boolean> {
  const sql = database().client;
  const [ownerTitle] = await sql`select canonical_title from titles where id=${titleId}`;
  if (!ownerTitle) return false;
  const ownerName = String(ownerTitle.canonical_title);

  const previousMedia = await sql`select ma.path from media_asset_assignments x
    join media_assets ma on ma.id=x.asset_id
    where x.installment_id in (select id from installments where title_id=${titleId})`;

  // Artwork is resolved before the transaction (it may download/store files).
  const posterPaths = new Map<number, string | null>();
  for (const [index, season] of input.seasons.entries()) {
    const kind = season.installmentKind ?? (season.units.length ? "season" : "movie");
    posterPaths.set(
      index,
      await materializeEmbeddedMedia(
        season.posterPath,
        `${ownerName} ${kind} ${Number(season.position ?? index) + 1} ${season.title}`,
        "poster",
      ),
    );
  }

  // An empty document keeps the title reachable with one placeholder season, as before.
  const seasons: SeasonInput[] = input.seasons.length
    ? input.seasons
    : [
        {
          title: ownerName,
          installmentKind: "season",
          summary: "",
          releaseStatus: "unknown",
          posterPath: null,
          position: 1,
          units: [],
        },
      ];

  const assignments: Array<{ installmentId: string; posterPath: string | null }> = [];
  await sql.begin(async (transaction) => {
    const existingRows = await transaction`select id from installments where title_id=${titleId}`;
    const existingIds = new Set(existingRows.map((row) => String(row.id)));
    const keptIds = new Set<string>();

    // Park every existing position so the reorder below cannot trip the unique index.
    if (existingIds.size) {
      await transaction`update installments set position = position + 100000
        where title_id=${titleId}`;
    }

    for (const [index, season] of seasons.entries()) {
      const kind = season.installmentKind ?? (season.units.length ? "season" : "movie");
      const position = Number(season.position ?? index + 1);
      const releaseDate = season.releaseAt
        ? new Date(Number(season.releaseAt)).toISOString().slice(0, 10)
        : null;
      const ids = {
        tmdb: season.tmdbId,
        imdb: season.imdbId,
        tvdb: season.tvdbId,
        anilist: season.anilistId,
        mal: season.malId,
      };
      let installmentId: string;
      if (season.id && existingIds.has(season.id)) {
        installmentId = season.id;
        keptIds.add(installmentId);
        // `undefined` id fields mean "not mentioned" — keep what the row has (an older JSON
        // document, or a caller that only touched episodes).
        await transaction`update installments set
            kind=${kind}, position=${position}, title=${season.title}, summary=${season.summary},
            release_date=${releaseDate}, runtime_minutes=${season.runtimeMinutes ?? null},
            status=${season.releaseStatus},
            tmdb_id=${ids.tmdb !== undefined ? ids.tmdb : transaction`tmdb_id`},
            imdb_id=${ids.imdb !== undefined ? ids.imdb : transaction`imdb_id`},
            tvdb_id=${ids.tvdb !== undefined ? ids.tvdb : transaction`tvdb_id`},
            anilist_id=${ids.anilist !== undefined ? ids.anilist : transaction`anilist_id`},
            mal_id=${ids.mal !== undefined ? ids.mal : transaction`mal_id`},
            updated_at=now()
          where id=${installmentId}`;
      } else {
        const [created] = await transaction`insert into installments
            (title_id, kind, position, title, summary, release_date, runtime_minutes, status,
             tmdb_id, imdb_id, tvdb_id, anilist_id, mal_id)
          values (${titleId}, ${kind}, ${position}, ${season.title}, ${season.summary},
            ${releaseDate}, ${season.runtimeMinutes ?? null}, ${season.releaseStatus},
            ${ids.tmdb ?? null}, ${ids.imdb ?? null}, ${ids.tvdb ?? null},
            ${ids.anilist ?? null}, ${ids.mal ?? null}) returning id`;
        if (!created) throw new Error("Could not create installment");
        installmentId = String(created.id);
        keptIds.add(installmentId);
      }
      assignments.push({
        installmentId,
        posterPath: posterPaths.get(index) ?? season.posterPath ?? null,
      });

      if (season.score) {
        const score = season.score;
        await transaction`insert into installment_scores
            (installment_id, story, characters, depth, world_building, originality, craft)
          values (${installmentId}, ${score.story ?? null}, ${score.characters ?? null},
            ${score.depth ?? null}, ${score.worldBuilding ?? null}, ${score.originality ?? null},
            ${score.craft ?? null})
          on conflict (installment_id) do update set
            story=excluded.story, characters=excluded.characters, depth=excluded.depth,
            world_building=excluded.world_building, originality=excluded.originality,
            craft=excluded.craft`;
      }

      await saveEpisodes(transaction, installmentId, season.units);
    }

    const removed = [...existingIds].filter((id) => !keptIds.has(id));
    if (removed.length) {
      await transaction`delete from installments where id in ${transaction(removed)}`;
    }
  });

  for (const assignment of assignments) {
    await assignMediaPath(sql, assignment.posterPath, "poster", {
      installmentId: assignment.installmentId,
    });
  }
  await purgeUnreferencedMedia(previousMedia.map((row) => String(row.path)));
  return true;
}

type Transaction = postgres.TransactionSql;

async function saveEpisodes(transaction: Transaction, installmentId: string, units: UnitInput[]) {
  const existingRows =
    await transaction`select id from episodes where installment_id=${installmentId}`;
  const existingIds = new Set(existingRows.map((row) => String(row.id)));
  const keptIds = new Set<string>();
  if (existingIds.size) {
    await transaction`update episodes set position = position + 100000, number = number + 100000
      where installment_id=${installmentId}`;
  }
  for (const [index, unit] of units.entries()) {
    const number = unit.unitNumber ?? index + 1;
    const position = Number(unit.position ?? index + 1);
    const releaseDate = unit.releaseAt
      ? new Date(Number(unit.releaseAt)).toISOString().slice(0, 10)
      : null;
    if (unit.id && existingIds.has(unit.id)) {
      keptIds.add(unit.id);
      await transaction`update episodes set number=${number}, position=${position},
          title=${unit.title ?? null}, summary=${unit.summary ?? ""}, release_date=${releaseDate},
          runtime_minutes=${unit.runtimeMinutes ?? null}, updated_at=now()
        where id=${unit.id}`;
    } else {
      const [created] = await transaction`insert into episodes
          (installment_id, number, position, title, summary, release_date, runtime_minutes)
        values (${installmentId}, ${number}, ${position}, ${unit.title ?? null},
          ${unit.summary ?? ""}, ${releaseDate}, ${unit.runtimeMinutes ?? null}) returning id`;
      if (created) keptIds.add(String(created.id));
    }
  }
  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length) {
    await transaction`delete from episodes where id in ${transaction(removed)}`;
  }
}
