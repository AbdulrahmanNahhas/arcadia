import type {
  AwardRecognition,
  BrowseResponse,
  Installment,
  TitleDetail,
  TitleSummary,
} from "@arcadia/contracts";
import {
  type Classification,
  effectiveClassification,
  effectivePolicy,
  installmentRating,
  isClassificationAllowed,
  isVisibleToPolicy,
  type Score,
  titleRating,
  type VisibilityPolicy,
} from "@arcadia/domain";
import { database } from "./database";

type SqlRow = Record<string, unknown>;
const numeric = (value: unknown) => (value == null ? null : Number(value));
const titleClassification = (row: SqlRow): Classification => ({
  audience: row.audience as Classification["audience"],
  age: row.age as Classification["age"],
  sexuality: row.sexuality_risk as Classification["sexuality"],
  behavioral: row.behavioral_risk as Classification["behavioral"],
  theology: row.theology_risk as Classification["theology"],
});
const scoreFrom = (row: SqlRow | undefined): Score => ({
  story: numeric(row?.story),
  characters: numeric(row?.characters),
  depth: numeric(row?.depth),
  worldBuilding: numeric(row?.world_building),
  originality: numeric(row?.originality),
  craft: numeric(row?.craft),
});

async function relatedData(titleIds: string[]) {
  if (!titleIds.length)
    return {
      installments: [] as SqlRow[],
      scores: [] as SqlRow[],
      genres: [] as SqlRow[],
      tones: [] as SqlRow[],
      tags: [] as SqlRow[],
      countries: [] as SqlRow[],
      planets: [] as SqlRow[],
      aliases: [] as SqlRow[],
      credits: [] as SqlRow[],
      awards: [] as SqlRow[],
    };
  const sql = database().client;
  const [installments, scores, genres, tones, tags, countries, planets, aliases, credits, awards] =
    await Promise.all([
      sql`select i.*,
      (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.installment_id=i.id and maa.role='poster' and maa.is_primary limit 1) as poster_path,
      (select count(*)::int from episodes e where e.installment_id=i.id) as episode_count,
      (select count(*) from installments sibling
        where sibling.title_id=i.title_id and sibling.kind in ('movie','special')) as film_count,
      exists(select 1 from episodes e where e.installment_id=i.id and e.number = floor(e.number))
        as has_integer_episode
      from installments i where i.title_id in ${sql(titleIds)} order by i.position`,
      sql`select s.* from installment_scores s join installments i on i.id=s.installment_id where i.title_id in ${sql(titleIds)}`,
      sql`select x.title_id, v.id, v.slug from title_genres x join genres v on v.id=x.value_id where x.title_id in ${sql(titleIds)}`,
      sql`select x.title_id, v.slug from title_tones x join tones v on v.id=x.value_id where x.title_id in ${sql(titleIds)}`,
      sql`select x.title_id, v.id, v.slug from title_tags x join tags v on v.id=x.value_id where x.title_id in ${sql(titleIds)}`,
      sql`select x.title_id, v.slug from title_countries x join countries v on v.id=x.value_id where x.title_id in ${sql(titleIds)}`,
      sql`select x.title_id, p.id, p.slug, p.name_ar, p.icon from title_planets x join planets p on p.id=x.planet_id where x.title_id in ${sql(titleIds)} order by p.display_order`,
      sql`select title_id, title from title_aliases where title_id in ${sql(titleIds)} order by title`,
      sql`select c.title_id, e.id, e.name, e.kind, r.slug as role, c.position, c.is_primary from contributions c join entities e on e.id=c.entity_id join roles r on r.id=c.role_id where c.title_id in ${sql(titleIds)} order by c.position, e.sort_name`,
      sql`select a.*, i.title as installment_title from award_recognitions a left join installments i on i.id=a.installment_id where a.title_id in ${sql(titleIds)} order by a.is_featured desc, a.year desc nulls last, a.position, a.organization_name, a.category`,
    ]);
  return {
    installments,
    scores,
    genres,
    tones,
    tags,
    countries,
    planets,
    aliases,
    credits,
    awards,
  };
}

export async function visibilityPolicyForAccount(
  accountId: string,
): Promise<VisibilityPolicy | null> {
  const sql = database().client;
  const [row, titleRows, tagRows, genreRows, entityRows, planetRows] = await Promise.all([
    sql`select p.audience, p.age, p.sexuality_risk, p.behavioral_risk, p.theology_risk,
      r.audience as restriction_audience, r.age as restriction_age,
      r.sexuality_risk as restriction_sexuality_risk,
      r.behavioral_risk as restriction_behavioral_risk,
      r.theology_risk as restriction_theology_risk
      from accounts a
      join account_content_policies p on p.account_id=a.id
      join account_admin_restrictions r on r.account_id=a.id
      where a.id=${accountId} and a.status='active'`,
    sql`select title_id as id from account_title_blocks where account_id=${accountId}`,
    sql`select tag_id as id from account_tag_blocks where account_id=${accountId}`,
    sql`select genre_id as id from account_genre_blocks where account_id=${accountId}`,
    sql`select entity_id as id from account_entity_blocks where account_id=${accountId}`,
    sql`select planet_id as id from account_planet_blocks where account_id=${accountId}`,
  ]);
  const policyRow = row[0];
  if (!policyRow) return null;
  const own = titleClassification(policyRow);
  const restriction: Classification = {
    audience: policyRow.restriction_audience as Classification["audience"],
    age: policyRow.restriction_age as Classification["age"],
    sexuality: policyRow.restriction_sexuality_risk as Classification["sexuality"],
    behavioral: policyRow.restriction_behavioral_risk as Classification["behavioral"],
    theology: policyRow.restriction_theology_risk as Classification["theology"],
  };
  const ids = (rows: SqlRow[]) => new Set(rows.map((item) => String(item.id)));
  return {
    maximum: effectivePolicy(own, restriction),
    blockedTitleIds: ids(titleRows),
    blockedTagIds: ids(tagRows),
    blockedGenreIds: ids(genreRows),
    blockedEntityIds: ids(entityRows),
    blockedPlanetIds: ids(planetRows),
  };
}

function isTitleVisible(
  row: SqlRow,
  data: Awaited<ReturnType<typeof relatedData>>,
  policy: VisibilityPolicy,
) {
  const titleId = String(row.id);
  if (
    !isVisibleToPolicy(
      {
        id: titleId,
        classification: titleClassification(row),
        tagIds: data.tags.filter((item) => item.title_id === row.id).map((item) => String(item.id)),
        genreIds: data.genres
          .filter((item) => item.title_id === row.id)
          .map((item) => String(item.id)),
        entityIds: data.credits
          .filter((item) => item.title_id === row.id)
          .map((item) => String(item.id)),
        planetIds: data.planets
          .filter((item) => item.title_id === row.id)
          .map((item) => String(item.id)),
      },
      policy,
    )
  ) {
    return false;
  }
  return data.installments
    .filter((item) => item.title_id === row.id)
    .every((item) =>
      isClassificationAllowed(
        effectiveClassification(titleClassification(row), {
          audience: item.audience_override as Classification["audience"] | null,
          age: item.age_override as Classification["age"] | null,
          sexuality: item.sexuality_risk_override as Classification["sexuality"] | null,
          behavioral: item.behavioral_risk_override as Classification["behavioral"] | null,
          theology: item.theology_risk_override as Classification["theology"] | null,
        }),
        policy.maximum,
      ),
    );
}

export async function visibleTitleIdsForAccount(accountId: string, titleIds: string[]) {
  if (!titleIds.length) return new Set<string>();
  const policy = await visibilityPolicyForAccount(accountId);
  if (!policy) return new Set<string>();
  const rows = await database()
    .client`select * from titles where id in ${database().client(titleIds)} and not is_private`;
  const data = await relatedData(rows.map((row) => String(row.id)));
  return new Set(
    rows.filter((row) => isTitleVisible(row, data, policy)).map((row) => String(row.id)),
  );
}

function award(row: SqlRow): AwardRecognition {
  return {
    id: String(row.id),
    organizationSlug: String(row.organization_slug),
    organizationName: String(row.organization_name),
    category: String(row.category),
    year: numeric(row.year),
    result: row.result as AwardRecognition["result"],
    isFeatured: Boolean(row.is_featured),
    installmentId: row.installment_id ? String(row.installment_id) : null,
    installmentTitle: row.installment_title ? String(row.installment_title) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

/**
 * A title does not store a mutable release state. Its lifecycle is always the
 * result of its installments, which makes movies, television, and anime agree.
 */
export function titleReleaseStatusFromInstallments(
  statuses: readonly string[],
): TitleSummary["releaseStatus"] {
  if (!statuses.length || statuses.includes("unknown")) return "unknown";
  if (statuses.includes("airing")) return "airing";
  if (statuses.every((status) => status === "announced")) return "upcoming";
  if (statuses.includes("announced") && statuses.includes("completed")) return "returning";
  if (statuses.every((status) => status === "completed")) return "completed";
  return "unknown";
}

function aggregateReleaseStatus(rows: SqlRow[]): TitleSummary["releaseStatus"] {
  return titleReleaseStatusFromInstallments(rows.map((row) => String(row.status)));
}

function averageScoreComponents(scores: Score[]): TitleSummary["score"]["components"] {
  return Object.fromEntries(
    (["story", "characters", "depth", "worldBuilding", "originality", "craft"] as const).map(
      (criterion) => {
        const values = scores
          .map((score) => score[criterion])
          .filter((value): value is number => typeof value === "number");
        return [
          criterion,
          values.length
            ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) /
              10
            : null,
        ];
      },
    ),
  ) as TitleSummary["score"]["components"];
}

function summary(
  row: SqlRow,
  data: Awaited<ReturnType<typeof relatedData>>,
  includePrivate = false,
): TitleSummary {
  const ownInstallments = data.installments.filter((item) => item.title_id === row.id);
  const ownScores = ownInstallments.map((item) =>
    scoreFrom(data.scores.find((score) => score.installment_id === item.id)),
  );
  const ownInstallmentDetails = ownInstallments.map((item) =>
    installment(
      item,
      row,
      data.scores.find((score) => score.installment_id === item.id),
    ),
  );
  const planet = data.planets.find((item) => item.title_id === row.id);
  return {
    id: String(row.id),
    canonicalTitle: String(row.canonical_title),
    kind: ownInstallments.some((item) => item.kind === "season") ? "anime" : "movie",
    titleAr: row.title_ar ? String(row.title_ar) : null,
    summary: String(row.summary),
    posterPath: row.poster_path ? String(row.poster_path) : null,
    bannerPath: row.banner_path ? String(row.banner_path) : null,
    logoPath: row.logo_path ? String(row.logo_path) : null,
    releaseYear: numeric(row.release_year),
    releaseStatus: aggregateReleaseStatus(ownInstallments),
    ...(includePrivate ? { isPrivate: Boolean(row.is_private) } : {}),
    aliases: [
      ...new Map(
        data.aliases
          .filter((item) => item.title_id === row.id)
          .map((item) => {
            const alias = String(item.title);
            return [alias.trim().toLocaleLowerCase(), alias] as const;
          }),
      ).values(),
    ],
    contentWarnings: row.content_warnings ? String(row.content_warnings) : null,
    analysisNotes: row.analysis_notes ? String(row.analysis_notes) : null,
    genres: data.genres
      .filter((item) => item.title_id === row.id)
      .map((item) => item.slug) as TitleSummary["genres"],
    tones: data.tones
      .filter((item) => item.title_id === row.id)
      .map((item) => item.slug) as TitleSummary["tones"],
    tags: data.tags
      .filter((item) => item.title_id === row.id)
      .map((item) => item.slug) as TitleSummary["tags"],
    countries: data.countries
      .filter((item) => item.title_id === row.id)
      .map((item) => String(item.slug)),
    planet: planet
      ? {
          id: String(planet.id),
          slug: String(planet.slug),
          nameAr: String(planet.name_ar),
          icon: String(planet.icon),
        }
      : null,
    score: { ...titleRating(ownScores), components: averageScoreComponents(ownScores) },
    classifications: [
      ...new Map(
        ownInstallmentDetails.map((item) => {
          return [JSON.stringify(item.classification), item.classification] as const;
        }),
      ).values(),
    ],
    credits: data.credits
      .filter((item) => item.title_id === row.id)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name),
        kind: item.kind as "person" | "organization",
        role: String(item.role),
        position: Number(item.position),
        isPrimary: Boolean(item.is_primary),
      })),
    awards: data.awards.filter((item) => item.title_id === row.id).map(award),
    isPlayable: ownInstallmentDetails.some((item) => item.isPlayable),
  };
}

function installment(
  row: SqlRow,
  title: SqlRow,
  scoreRow?: SqlRow,
  awards: SqlRow[] = [],
): Installment {
  const base = titleClassification(title);
  const overrideMap = {
    audience: row.audience_override,
    age: row.age_override,
    sexuality: row.sexuality_risk_override,
    behavioral: row.behavioral_risk_override,
    theology: row.theology_risk_override,
  };
  const score = scoreFrom(scoreRow);
  // Mirrors the play buttons' own two gates (`unplayableReason`/`unplayableEpisodeReason` in
  // `apps/web/.../play-button.tsx`) and the streams route's id-resolution rules
  // (`resolveStreamId`/`resolveSeriesStreamId` in `app.ts`): released — "announced" never counts,
  // neither does a release date still in the future, though a "completed" season is trusted on
  // status alone since most seasons only carry a release date at the season level, not per
  // episode — **and** id-resolvable (own id, or a sole-film title's; a season needs the title's id
  // plus at least one integer-numbered episode, since a season never carries its own id and
  // Torrentio's series ids have no slot for a fractional episode number).
  const releaseDate = row.release_date ? new Date(String(row.release_date)) : null;
  const releasedByDate =
    row.status !== "announced" && releaseDate !== null && releaseDate <= new Date();
  const hasReleased =
    row.kind === "season" ? row.status === "completed" || releasedByDate : releasedByDate;
  const isPlayable =
    hasReleased &&
    (row.kind === "season"
      ? Boolean((title.imdb_id || title.tmdb_id) && row.has_integer_episode)
      : Boolean(
          row.imdb_id ||
            row.tmdb_id ||
            (Number(row.film_count) === 1 && (title.imdb_id || title.tmdb_id)),
        ));
  return {
    id: String(row.id),
    titleId: String(row.title_id),
    kind: row.kind as Installment["kind"],
    position: Number(row.position),
    title: String(row.title),
    summary: String(row.summary),
    releaseDate: row.release_date ? String(row.release_date) : null,
    runtimeMinutes: numeric(row.runtime_minutes),
    status: row.status as Installment["status"],
    posterPath: row.poster_path ? String(row.poster_path) : null,
    episodeCount: numeric(row.episode_count),
    classification: effectiveClassification(base, overrideMap as never),
    classificationOverrides: Object.entries(overrideMap)
      .filter(([, value]) => value != null)
      .map(([key]) => key),
    score: score as Installment["score"],
    rating: installmentRating(score),
    awards: awards.filter((item) => item.installment_id === row.id).map(award),
    isPlayable,
    tmdbId: numeric(row.tmdb_id),
    imdbId: row.imdb_id ? String(row.imdb_id) : null,
    tvdbId: numeric(row.tvdb_id),
    anilistId: numeric(row.anilist_id),
    malId: numeric(row.mal_id),
  };
}

function compareArabicTitle(left: string, right: string) {
  return left.localeCompare(right, "ar");
}

function compareNewest(left: string | number | null, right: string | number | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? 1 : -1;
}

function sortTitleSummaries(items: TitleSummary[], sort: "title" | "release" | "score") {
  return [...items].sort((left, right) => {
    if (sort === "release") {
      const comparison = compareNewest(left.releaseYear, right.releaseYear);
      if (comparison) return comparison;
    }
    if (sort === "score") {
      const comparison = compareNewest(left.score.rating, right.score.rating);
      if (comparison) return comparison;
    }
    return compareArabicTitle(
      left.titleAr ?? left.canonicalTitle,
      right.titleAr ?? right.canonicalTitle,
    );
  });
}

function sortInstallments(
  items: Installment[],
  titlesById: Map<string, SqlRow>,
  sort: "title" | "release" | "score",
) {
  return [...items].sort((left, right) => {
    if (sort === "release") {
      const comparison = compareNewest(left.releaseDate, right.releaseDate);
      if (comparison) return comparison;
    }
    if (sort === "score") {
      const comparison = compareNewest(left.rating, right.rating);
      if (comparison) return comparison;
    }
    const leftParent = titlesById.get(left.titleId);
    const rightParent = titlesById.get(right.titleId);
    const titleComparison = compareArabicTitle(
      leftParent?.title_ar
        ? String(leftParent.title_ar)
        : String(leftParent?.canonical_title ?? left.title),
      rightParent?.title_ar
        ? String(rightParent.title_ar)
        : String(rightParent?.canonical_title ?? right.title),
    );
    return (
      titleComparison ||
      left.position - right.position ||
      compareArabicTitle(left.title, right.title)
    );
  });
}

export async function browse(
  input: {
    q?: string;
    mode: "titles" | "installments";
    sort: "title" | "release" | "score";
    limit: number;
    offset: number;
  },
  includePrivate = false,
  accountId?: string,
): Promise<BrowseResponse> {
  const sql = database().client;
  const pattern = `%${input.q ?? ""}%`;
  const searchCondition = sql`(${input.q ?? ""} = '' or t.canonical_title ilike ${pattern} or t.title_ar ilike ${pattern} or a.title ilike ${pattern} or exists (select 1 from contributions c join entities e on e.id=c.entity_id left join entity_aliases ea on ea.entity_id=e.id where c.title_id=t.id and e.kind='organization' and (e.name ilike ${pattern} or e.sort_name ilike ${pattern} or ea.alias ilike ${pattern})))`;
  if (input.mode === "installments") {
    const matchingTitles = await sql`select distinct t.*,
        (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='poster' and maa.is_primary limit 1) as poster_path,
        (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='banner' and maa.is_primary limit 1) as banner_path,
        (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='logo' and maa.is_primary limit 1) as logo_path
        from titles t left join title_aliases a on a.title_id=t.id where (${includePrivate} or not t.is_private) and ${searchCondition} order by t.sort_title`;
    const allData = await relatedData(matchingTitles.map((row) => String(row.id)));
    const policy = accountId ? await visibilityPolicyForAccount(accountId) : null;
    const visibleTitles = accountId
      ? policy
        ? matchingTitles.filter((row) => isTitleVisible(row, allData, policy))
        : []
      : matchingTitles;
    const titlesById = new Map(visibleTitles.map((title) => [String(title.id), title]));
    const matchingInstallments = sortInstallments(
      allData.installments
        .filter((row) => titlesById.has(String(row.title_id)))
        .map((row) =>
          installment(
            row,
            titlesById.get(String(row.title_id)) as SqlRow,
            allData.scores.find((score) => score.installment_id === row.id),
            allData.awards,
          ),
        ),
      titlesById,
      input.sort,
    );
    return {
      mode: input.mode,
      total: matchingInstallments.length,
      items: matchingInstallments.slice(input.offset, input.offset + input.limit),
    };
  }
  const rows = await sql`select distinct t.*,
      (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='poster' and maa.is_primary limit 1) as poster_path,
      (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='banner' and maa.is_primary limit 1) as banner_path,
      (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='logo' and maa.is_primary limit 1) as logo_path
      from titles t left join title_aliases a on a.title_id=t.id where (${includePrivate} or not t.is_private) and ${searchCondition}`;
  const data = await relatedData(rows.map((row) => String(row.id)));
  const policy = accountId ? await visibilityPolicyForAccount(accountId) : null;
  const visibleRows = accountId
    ? policy
      ? rows.filter((row) => isTitleVisible(row, data, policy))
      : []
    : rows;
  const items = sortTitleSummaries(
    visibleRows.map((row) => summary(row, data, includePrivate)),
    input.sort,
  );
  return {
    mode: input.mode,
    total: items.length,
    items: items.slice(input.offset, input.offset + input.limit),
  };
}

export async function titleDetail(
  id: string,
  includePrivate = false,
  accountId?: string,
): Promise<TitleDetail | null> {
  const sql = database().client;
  const [resolved] = await sql`
    select id as title_id from titles where id=${id}
    union all
    select title_id from installments where id=${id}
    union all
    select i.title_id from episodes e join installments i on i.id=e.installment_id where e.id=${id}
    limit 1`;
  if (!resolved) return null;
  const titleId = String(resolved.title_id);
  const [row] = await sql`select t.*,
      (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='poster' and maa.is_primary limit 1) as poster_path,
      (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='banner' and maa.is_primary limit 1) as banner_path,
      (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id where maa.title_id=t.id and maa.role='logo' and maa.is_primary limit 1) as logo_path
      from titles t where id=${titleId} and (${includePrivate} or not is_private)`;
  if (!row) return null;
  const data = await relatedData([titleId]);
  if (accountId) {
    const policy = await visibilityPolicyForAccount(accountId);
    if (!policy || !isTitleVisible(row, data, policy)) return null;
  }
  const installmentRows = await Promise.all(
    data.installments.map(async (item) => {
      const episodeRows = await sql`
        select id, number::float, position, title, summary,
          release_date as "releaseDate", runtime_minutes as "runtimeMinutes",
          (select ma.path from media_asset_assignments maa join media_assets ma on ma.id=maa.asset_id
            where maa.episode_id=e.id and maa.role='poster' and maa.is_primary limit 1) as poster_path
        from episodes e where installment_id=${item.id} order by position`;
      return {
        ...installment(
          item,
          row,
          data.scores.find((score) => score.installment_id === item.id),
          data.awards,
        ),
        episodes: episodeRows.map((episode) => ({
          id: String(episode.id),
          number: Number(episode.number),
          position: Number(episode.position),
          title: episode.title ? String(episode.title) : null,
          summary: episode.summary ? String(episode.summary) : "",
          releaseDate: episode.releaseDate ? String(episode.releaseDate) : null,
          runtimeMinutes: numeric(episode.runtimeMinutes),
          posterPath: episode.poster_path ? String(episode.poster_path) : null,
        })),
      };
    }),
  );
  const [relationships, credits, externalIdentities] = await Promise.all([
    sql`select r.id, r.kind as type, r.notes, r.source_title_id,
      other.id as title_id, other.canonical_title as title
      from title_relations r
      join titles other on other.id=case when r.source_title_id=${titleId} then r.target_title_id else r.source_title_id end
      where (r.source_title_id=${titleId} or r.target_title_id=${titleId})
        and (${includePrivate} or not other.is_private)`,
    sql`select e.id, e.name, e.kind, r.slug as role, c.position, c.is_primary
      from contributions c join entities e on e.id=c.entity_id join roles r on r.id=c.role_id
      where c.title_id=${titleId} order by c.position`,
    sql`select id, provider, external_id, url from external_identities
      where title_id=${titleId} order by provider, external_id`,
  ]);
  const visibleRelationshipIds = accountId
    ? await visibleTitleIdsForAccount(
        accountId,
        relationships.map((item) => String(item.title_id)),
      )
    : null;
  return {
    ...summary(row, data, includePrivate),
    tmdbId: numeric(row.tmdb_id),
    imdbId: row.imdb_id ? String(row.imdb_id) : null,
    tvdbId: numeric(row.tvdb_id),
    anilistId: numeric(row.anilist_id),
    malId: numeric(row.mal_id),
    installments: installmentRows,
    relationships: relationships
      .filter(
        (item) => !visibleRelationshipIds || visibleRelationshipIds.has(String(item.title_id)),
      )
      .map((item) => ({
        id: String(item.id),
        type: String(item.type),
        titleId: String(item.title_id),
        title: String(item.title),
        direction: item.source_title_id === titleId ? ("outgoing" as const) : ("incoming" as const),
        notes: String(item.notes ?? ""),
      })),
    credits: credits.map((credit) => ({
      id: String(credit.id),
      name: String(credit.name),
      kind: credit.kind as "person" | "organization",
      role: String(credit.role),
      position: Number(credit.position),
      isPrimary: Boolean(credit.is_primary),
    })),
    externalIdentities: externalIdentities.map((identity) => ({
      id: String(identity.id),
      provider: String(identity.provider),
      externalId: String(identity.external_id),
      url: identity.url ? String(identity.url) : null,
    })),
    ...(includePrivate
      ? {
          workflowStatus: String(row.workflow_status) as
            | "draft"
            | "in_review"
            | "approved"
            | "published"
            | "archived",
          qualityScore: Number(row.quality_score),
          curatorNotes: String(row.curator_notes ?? ""),
          provenance:
            row.provenance && typeof row.provenance === "object"
              ? (row.provenance as Record<string, unknown>)
              : {},
          verifiedAt: row.verified_at ? new Date(String(row.verified_at)).toISOString() : null,
        }
      : {}),
  };
}
