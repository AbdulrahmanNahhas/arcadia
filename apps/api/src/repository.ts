import type { BrowseResponse, Installment, TitleDetail, TitleSummary } from "@arcadia/contracts";
import {
  type Classification,
  effectiveClassification,
  installmentRating,
  type Score,
  titleRating,
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
      planets: [] as SqlRow[],
    };
  const sql = database().client;
  const [installments, scores, genres, tones, tags, planets] = await Promise.all([
    sql`select i.*, (select count(*)::int from episodes e where e.installment_id=i.id) as episode_count from installments i where i.title_id in ${sql(titleIds)} order by i.position`,
    sql`select s.* from installment_scores s join installments i on i.id=s.installment_id where i.title_id in ${sql(titleIds)}`,
    sql`select x.title_id, v.slug from title_genres x join genres v on v.id=x.value_id where x.title_id in ${sql(titleIds)}`,
    sql`select x.title_id, v.slug from title_tones x join tones v on v.id=x.value_id where x.title_id in ${sql(titleIds)}`,
    sql`select x.title_id, v.slug from title_tags x join tags v on v.id=x.value_id where x.title_id in ${sql(titleIds)}`,
    sql`select x.title_id, p.id, p.slug, p.name_ar, p.icon from title_planets x join planets p on p.id=x.planet_id where x.title_id in ${sql(titleIds)} order by p.display_order`,
  ]);
  return { installments, scores, genres, tones, tags, planets };
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
    ...(includePrivate ? { isPrivate: Boolean(row.is_private) } : {}),
    genres: data.genres
      .filter((item) => item.title_id === row.id)
      .map((item) => item.slug) as TitleSummary["genres"],
    tones: data.tones
      .filter((item) => item.title_id === row.id)
      .map((item) => item.slug) as TitleSummary["tones"],
    tags: data.tags
      .filter((item) => item.title_id === row.id)
      .map((item) => item.slug) as TitleSummary["tags"],
    planet: planet
      ? {
          id: String(planet.id),
          slug: String(planet.slug),
          nameAr: String(planet.name_ar),
          icon: String(planet.icon),
        }
      : null,
    score: titleRating(ownScores),
    classifications: ownInstallments.map(
      (item) =>
        installment(
          item,
          row,
          data.scores.find((score) => score.installment_id === item.id),
        ).classification,
    ),
  };
}

function installment(row: SqlRow, title: SqlRow, scoreRow?: SqlRow): Installment {
  const base = titleClassification(title);
  const overrideMap = {
    audience: row.audience_override,
    age: row.age_override,
    sexuality: row.sexuality_risk_override,
    behavioral: row.behavioral_risk_override,
    theology: row.theology_risk_override,
  };
  const score = scoreFrom(scoreRow);
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
): Promise<BrowseResponse> {
  const sql = database().client;
  const pattern = `%${input.q ?? ""}%`;
  const searchCondition = sql`(${input.q ?? ""} = '' or t.canonical_title ilike ${pattern} or t.title_ar ilike ${pattern} or a.title ilike ${pattern} or exists (select 1 from contributions c join entities e on e.id=c.entity_id left join entity_aliases ea on ea.entity_id=e.id where c.title_id=t.id and e.kind='organization' and (e.name ilike ${pattern} or e.sort_name ilike ${pattern} or ea.alias ilike ${pattern})))`;
  if (input.mode === "installments") {
    const matchingTitles =
      await sql`select distinct t.* from titles t left join title_aliases a on a.title_id=t.id where (${includePrivate} or not t.is_private) and ${searchCondition} order by t.sort_title`;
    const allData = await relatedData(matchingTitles.map((row) => String(row.id)));
    const titlesById = new Map(matchingTitles.map((title) => [String(title.id), title]));
    const matchingInstallments = sortInstallments(
      allData.installments.map((row) =>
        installment(
          row,
          titlesById.get(String(row.title_id)) as SqlRow,
          allData.scores.find((score) => score.installment_id === row.id),
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
  const rows =
    await sql`select distinct t.* from titles t left join title_aliases a on a.title_id=t.id where (${includePrivate} or not t.is_private) and ${searchCondition}`;
  const data = await relatedData(rows.map((row) => String(row.id)));
  const items = sortTitleSummaries(
    rows.map((row) => summary(row, data, includePrivate)),
    input.sort,
  );
  return {
    mode: input.mode,
    total: items.length,
    items: items.slice(input.offset, input.offset + input.limit),
  };
}

export async function titleDetail(id: string, includePrivate = false): Promise<TitleDetail | null> {
  const sql = database().client;
  const [row] =
    await sql`select * from titles where id=${id} and (${includePrivate} or not is_private)`;
  if (!row) return null;
  const data = await relatedData([id]);
  const installmentRows = await Promise.all(
    data.installments.map(async (item) => {
      const episodeRows =
        await sql`select id, number::float, position, title, release_date as "releaseDate", runtime_minutes as "runtimeMinutes" from episodes where installment_id=${item.id} order by position`;
      return {
        ...installment(
          item,
          row,
          data.scores.find((score) => score.installment_id === item.id),
        ),
        episodes: episodeRows.map((episode) => ({
          id: String(episode.id),
          number: Number(episode.number),
          position: Number(episode.position),
          title: episode.title ? String(episode.title) : null,
          releaseDate: episode.releaseDate ? String(episode.releaseDate) : null,
          runtimeMinutes: numeric(episode.runtimeMinutes),
        })),
      };
    }),
  );
  const relationships =
    await sql`select r.id, r.kind as type, other.id as title_id, other.canonical_title as title from title_relations r join titles other on other.id=case when r.source_title_id=${id} then r.target_title_id else r.source_title_id end where (r.source_title_id=${id} or r.target_title_id=${id}) and (${includePrivate} or not other.is_private)`;
  const credits =
    await sql`select e.id, e.name, e.kind, r.slug as role from contributions c join entities e on e.id=c.entity_id join roles r on r.id=c.role_id where c.title_id=${id} order by c.position`;
  return {
    ...summary(row, data, includePrivate),
    contentWarnings: row.content_warnings ? String(row.content_warnings) : null,
    analysisNotes: row.analysis_notes ? String(row.analysis_notes) : null,
    installments: installmentRows,
    relationships: relationships.map((item) => ({
      id: String(item.id),
      type: String(item.type),
      titleId: String(item.title_id),
      title: String(item.title),
    })),
    credits: credits.map((credit) => ({
      id: String(credit.id),
      name: String(credit.name),
      kind: credit.kind as "person" | "organization",
      role: String(credit.role),
    })),
  };
}
