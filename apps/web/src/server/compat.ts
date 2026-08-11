import type { Installment, TitleDetail, TitleSummary } from "@arcadia/contracts";
import { taxonomy } from "@arcadia/domain";
import type {
  Entity,
  Work,
  WorkContribution,
  WorkRelation,
  WorkStructure,
} from "@/features/library/model";
import type { Planet, PlanetWithWorks, Recommendation } from "@/features/platform/model";
import { apiFetch, browseTitles, getPlanets as fetchPlanets, getTitle } from "@/lib/api";

const titleCase: Record<string, string> = {
  "science-fiction": "Science Fiction",
  "slice-of-life": "Slice of Life",
  "young-adult": "Young Adult",
};
const roleValues = new Set([
  "author",
  "original-author",
  "writer",
  "screenwriter",
  "director",
  "illustrator",
  "artist",
  "animation-studio",
  "production-company",
  "producer",
  "developer",
  "publisher",
  "composer",
  "editor",
  "translator",
  "creator",
]);

export function labelFromSlug(slug: string) {
  return (
    titleCase[slug] ??
    slug
      .split("-")
      .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
      .join(" ")
  );
}

function controlledLabel(vocabulary: keyof typeof taxonomy, slug: string) {
  return taxonomy[vocabulary].find(([value]) => value === slug)?.[1] ?? labelFromSlug(slug);
}

function frequencies(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function audience(value: string | undefined): Work["audience"] {
  return value === "young-adult"
    ? "Young Adult"
    : value === "adult"
      ? "Adult"
      : value === "teen"
        ? "Teen"
        : value === "general"
          ? "General"
          : null;
}

function contribution(credit: TitleDetail["credits"][number]): WorkContribution {
  return {
    entityId: credit.id,
    name: credit.name,
    entityType: credit.kind,
    role: (roleValues.has(credit.role) ? credit.role : "creator") as WorkContribution["role"],
    isPrimary: false,
  };
}

export function titleToWork(title: TitleSummary | TitleDetail): Work {
  const installments = "installments" in title ? title.installments : [];
  const first = installments[0];
  const episodic = installments.some((item) => item.kind === "season");
  const episodeCount = installments.reduce((sum, item) => sum + (item.episodes?.length ?? 0), 0);
  const credits = "credits" in title ? title.credits.map(contribution) : [];
  const relations: WorkRelation[] =
    "relationships" in title
      ? title.relationships.map((relation) => ({
          id: relation.id,
          workId: relation.titleId,
          relationType: ([
            "adaptation",
            "sequel",
            "spin-off",
            "side-story",
            "compilation",
            "alternative",
            "related",
          ].includes(relation.type)
            ? relation.type
            : "related") as WorkRelation["relationType"],
          direction: "outgoing",
          notes: "",
          provenance: "v2",
          externalKey: null,
          work: {
            id: relation.titleId,
            title: relation.title,
            kind: "movie",
            year: null,
            releaseStatus: "unknown",
            imagePath: null,
          },
        }))
      : [];
  const score = title.score.components;
  const now = Date.now();
  return {
    id: title.id,
    title: title.canonicalTitle,
    arabicTitle: title.titleAr,
    kind: title.kind,
    year: title.releaseYear,
    releaseStatus: title.releaseStatus,
    isPrivate: title.isPrivate ?? false,
    planetId: title.planet?.id ?? null,
    runtimeMinutes: first?.runtimeMinutes ?? null,
    playtimeMinutes: null,
    pageCount: null,
    episodeCount: episodic ? episodeCount : null,
    chapterCount: null,
    volumeCount: null,
    routeCount: null,
    status: "saved",
    progress: 0,
    progressTotal: episodic ? episodeCount : null,
    progressUnit: episodic ? "episodes" : "hours",
    calculatedRating: title.score.rating,
    scoreCoverage: { scored: title.score.scored, total: title.score.total },
    favorite: false,
    completedAt: null,
    trackedOn: null,
    summary: title.summary,
    tags: title.tags.map((slug) => controlledLabel("tags", slug)),
    genres: title.genres.map((slug) => controlledLabel("genres", slug)) as Work["genres"],
    aliases: title.aliases,
    studios: credits.filter((item) => item.entityType === "organization").map((item) => item.name),
    audience: audience(title.classifications[0]?.audience),
    sharedWith: [],
    tone: title.tones.map((slug) => controlledLabel("tones", slug)) as Work["tone"],
    contentWarnings: title.contentWarnings,
    analysisNotes: "analysisNotes" in title ? title.analysisNotes : null,
    riskProfile: title.classifications[0]
      ? {
          sexuality: title.classifications[0].sexuality,
          behavioral: title.classifications[0].behavioral,
          theology: title.classifications[0].theology,
        }
      : null,
    scoreComponents: Object.fromEntries(Object.entries(score).filter((entry) => entry[1] !== null)),
    externalLinks: [],
    releaseStart: first?.releaseDate ?? null,
    releaseEnd: null,
    watchDates: null,
    country: [],
    sourceMaterial: null,
    publication: null,
    curation: null,
    contributors: credits,
    animationStudios: credits.filter((item) => item.role === "animation-studio"),
    productionCompanies: credits.filter((item) => item.role === "production-company"),
    publishers: credits.filter((item) => item.role === "publisher"),
    relations,
    isSequelMovie: relations.some((item) => item.relationType === "sequel"),
    creator: credits[0]?.name ?? "",
    imagePath: title.posterPath,
    bannerPath: title.bannerPath,
    logoPath: title.logoPath,
    palette: title.planet?.slug ?? "violet",
    addedAt: now,
    catalogUpdatedAt: now,
    personalUpdatedAt: now,
  };
}

function episodeUnit(
  workId: string,
  installment: Installment,
  episode: NonNullable<Installment["episodes"]>[number],
) {
  return {
    id: episode.id,
    workId,
    seasonId: installment.id,
    unitType: "episode" as const,
    title: episode.title,
    unitNumber: episode.number,
    position: episode.position,
    runtimeMinutes: episode.runtimeMinutes,
    pageCount: null,
    releaseAt: episode.releaseDate ? new Date(episode.releaseDate).valueOf() : null,
    progress: null,
  };
}

export function detailToStructure(detail: TitleDetail): WorkStructure {
  const seasons = detail.installments.map((item) => ({
    id: item.id,
    workId: detail.id,
    title: item.title,
    installmentKind: item.kind,
    summary: item.summary,
    releaseStatus: item.status,
    rating: item.rating,
    score: item.score,
    seasonNumber: item.kind === "season" ? item.position : null,
    position: item.position,
    runtimeMinutes: item.runtimeMinutes,
    unitCount: item.episodes?.length ?? (item.kind === "movie" ? 1 : 0),
    releaseAt: item.releaseDate ? new Date(item.releaseDate).valueOf() : null,
    posterPath: item.posterPath,
    progress: null,
    units: (item.episodes ?? []).map((episode) => episodeUnit(detail.id, item, episode)),
  }));
  return {
    workId: detail.id,
    seasons,
    ungroupedUnits: [],
    completedUnits: 0,
    totalUnits: seasons.reduce((sum, item) => sum + item.units.length, 0),
  };
}

export async function allTitles(query?: string) {
  const search = query?.trim();
  const first = await browseTitles({
    limit: 100,
    offset: 0,
    mode: "titles",
    ...(search ? { q: search } : {}),
  });
  const remaining =
    first.total > 100
      ? await browseTitles({
          limit: 100,
          offset: 100,
          mode: "titles",
          ...(search ? { q: search } : {}),
        })
      : null;
  return [...first.items, ...(remaining?.items ?? [])].filter(
    (item): item is TitleSummary => "canonicalTitle" in item,
  );
}

export async function allWorks(query?: string) {
  return (await allTitles(query)).map(titleToWork);
}

function installmentWorks(items: Installment[], titles: TitleSummary[]) {
  const titlesById = new Map(titles.map((title) => [title.id, titleToWork(title)]));
  const now = Date.now();
  return items.map((item): Work => {
    const title = titlesById.get(item.titleId);
    return {
      id: item.titleId,
      title: title?.title ?? item.title,
      arabicTitle: title?.arabicTitle ?? item.title,
      installmentId: item.id,
      installmentTitle: item.title,
      kind: title?.kind ?? (item.kind === "season" ? "anime" : "movie"),
      year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
      releaseStatus: item.status,
      isPrivate: title?.isPrivate ?? false,
      planetId: title?.planetId ?? null,
      runtimeMinutes: item.runtimeMinutes,
      playtimeMinutes: null,
      pageCount: null,
      episodeCount: item.kind === "season" ? item.episodeCount : null,
      chapterCount: null,
      volumeCount: null,
      routeCount: null,
      status: "saved",
      progress: 0,
      progressTotal: null,
      progressUnit: "episodes",
      calculatedRating: item.rating,
      scoreCoverage: { scored: item.rating === null ? 0 : 1, total: 1 },
      favorite: false,
      completedAt: null,
      trackedOn: null,
      summary: item.summary || title?.summary || "",
      tags: title?.tags ?? [],
      genres: title?.genres ?? [],
      aliases: title?.aliases ?? [],
      studios: title?.studios ?? [],
      sharedWith: [],
      tone: title?.tone ?? [],
      country: title?.country ?? [],
      audience: audience(item.classification.audience),
      contentWarnings: title?.contentWarnings ?? null,
      analysisNotes: null,
      riskProfile: item.classification,
      scoreComponents: Object.fromEntries(
        Object.entries(item.score).filter(([, value]) => value !== null),
      ),
      externalLinks: [],
      releaseStart: item.releaseDate,
      releaseEnd: null,
      watchDates: null,
      sourceMaterial: null,
      publication: null,
      curation: null,
      contributors: title?.contributors ?? [],
      animationStudios: title?.animationStudios ?? [],
      productionCompanies: title?.productionCompanies ?? [],
      publishers: title?.publishers ?? [],
      relations: title?.relations ?? [],
      isSequelMovie: false,
      creator: title?.creator ?? "",
      imagePath: item.posterPath ?? title?.imagePath ?? null,
      bannerPath: title?.bannerPath ?? null,
      logoPath: title?.logoPath ?? null,
      palette: title?.palette ?? "violet",
      addedAt: now,
      catalogUpdatedAt: now,
      personalUpdatedAt: now,
    };
  });
}

export async function allInstallmentWorks(query?: string) {
  const search = query?.trim();
  const [titles, first] = await Promise.all([
    allTitles(search),
    browseTitles({
      limit: 100,
      offset: 0,
      mode: "installments",
      sort: "release",
      ...(search ? { q: search } : {}),
    }),
  ]);
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(first.total / 100) - 1) }, (_, index) =>
      browseTitles({
        limit: 100,
        offset: (index + 1) * 100,
        mode: "installments",
        sort: "release",
        ...(search ? { q: search } : {}),
      }),
    ),
  );
  const items = [...first.items, ...remaining.flatMap((page) => page.items)].filter(
    (item): item is Installment => "titleId" in item,
  );
  return installmentWorks(items, titles);
}

export async function allAdminTitles() {
  const first = await apiFetch<{ items: TitleSummary[]; total: number }>(
    "/api/v1/admin/titles?limit=100",
  );
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(first.total / 100) - 1) }, (_, index) =>
      apiFetch<{ items: TitleSummary[] }>(
        `/api/v1/admin/titles?limit=100&offset=${(index + 1) * 100}`,
      ),
    ),
  );
  return [...first.items, ...remaining.flatMap((page) => page.items)];
}

export async function allAdminWorks() {
  return (await allAdminTitles()).map(titleToWork);
}

export async function allAdminInstallmentWorks() {
  const titles = await allAdminTitles();
  const first = await apiFetch<{ items: Array<TitleSummary | Installment>; total: number }>(
    "/api/v1/admin/titles?mode=installments&limit=100",
  );
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(first.total / 100) - 1) }, (_, index) =>
      apiFetch<{ items: Array<TitleSummary | Installment> }>(
        `/api/v1/admin/titles?mode=installments&limit=100&offset=${(index + 1) * 100}`,
      ),
    ),
  );
  const items = [...first.items, ...remaining.flatMap((page) => page.items)].filter(
    (item): item is Installment => "titleId" in item,
  );
  return installmentWorks(items, titles);
}

export async function fullAdminDetail(id: string) {
  return apiFetch<TitleDetail>(`/api/v1/admin/titles/${id}`);
}

export async function planetsWithWorks(includeInactive = false): Promise<PlanetWithWorks[]> {
  const [rows, works] = await Promise.all([fetchPlanets(), allWorks()]);

  return rows
    .map((row, index) => {
      const planetWorks = works
        .filter(
          (work) =>
            work.planetId === row.id &&
            work.releaseStatus !== "announced" &&
            work.releaseStart !== "unknown",
        )
        .sort((left, right) => {
          const yearLeft = left.year ? Number(left.year) : 0;
          const yearRight = right.year ? Number(right.year) : 0;

          // Descending sort (Newest year first)
          const yearDiff = yearRight - yearLeft;

          if (yearDiff !== 0) return yearDiff;

          // Fallback tie-breaker for works from the same year
          const titleLeft = left.arabicTitle || left.title || "";
          const titleRight = right.arabicTitle || right.title || "";
          return titleLeft.localeCompare(titleRight, "ar");
        });

      const planet: Planet = {
        ...row,
        displayOrder: index,
        isActive: true,
        workCount: planetWorks.length,
        reviewCount: 0,
      };

      return { ...planet, works: planetWorks };
    })
    .filter((planet) => includeInactive || planet.isActive);
}
export async function entities(): Promise<Entity[]> {
  type EntityRow = {
    id: string;
    name: string;
    sortName?: string;
    description: string;
    profilePath: string | null;
    works?: Array<{
      id: string;
      title: string;
      arabicTitle: string | null;
      year: number | null;
      kind: Work["kind"];
      releaseStatus: Work["releaseStatus"];
      imagePath: string | null;
      roles: WorkContribution["role"][];
    }>;
  };
  const [people, organizations] = await Promise.all([
    apiFetch<EntityRow[]>("/api/v1/people"),
    apiFetch<EntityRow[]>("/api/v1/studios"),
  ]);
  return [
    ...people.map((item) => ({ ...item, entityType: "person" as const })),
    ...organizations.map((item) => ({ ...item, entityType: "organization" as const })),
  ].map((item) => ({
    id: item.id,
    name: item.name,
    sortName: item.sortName ?? item.name,
    entityType: item.entityType,
    description: item.description,
    imagePath: item.profilePath,
    primaryUrl: null,
    malId: null,
    anilistId: null,
    imdbId: null,
    wikipediaUrl: null,
    establishedAt: null,
    birthDate: null,
    deathDate: null,
    favorites: null,
    workCount: item.works?.length ?? 0,
    roles: Object.entries(frequencies((item.works ?? []).flatMap((work) => work.roles))).map(
      ([role, count]) => ({ role: role as WorkContribution["role"], count }),
    ),
    kinds: Object.entries(frequencies((item.works ?? []).map((work) => work.kind))).map(
      ([kind, count]) => ({ kind: kind as Work["kind"], count }),
    ),
    works: (item.works ?? []).map((work) => ({
      ...work,
      status: "saved" as const,
      calculatedRating: null,
      isSequelMovie: false,
    })),
  }));
}

export function recommendationsFor(work: Work, works: Work[], limit = 10): Recommendation[] {
  return works
    .filter((item) => item.id !== work.id)
    .map((candidate) => {
      const genres = candidate.genres.filter((value) => work.genres.includes(value));
      const tags = candidate.tags.filter((value) => work.tags.includes(value));
      const tones = candidate.tone.filter((value) => work.tone.includes(value));
      const samePlanet = Boolean(work.planetId && candidate.planetId === work.planetId);
      const sameAudience = Boolean(work.audience && candidate.audience === work.audience);
      const sameKind = candidate.kind === work.kind;
      const closeEra = Boolean(
        work.year && candidate.year && Math.abs(work.year - candidate.year) <= 5,
      );
      const closeScore = Boolean(
        work.calculatedRating != null &&
          candidate.calculatedRating != null &&
          Math.abs(work.calculatedRating - candidate.calculatedRating) <= 0.75,
      );
      const isRelated = work.relations.some((relation) => relation.workId === candidate.id);
      const reasons: Recommendation["reasons"] = [
        ...genres
          .slice(0, 2)
          .map((label) => ({ signal: "genre" as const, label, contribution: 12 })),
        ...tags.slice(0, 3).map((label) => ({ signal: "tag" as const, label, contribution: 7 })),
        ...tones.slice(0, 2).map((label) => ({ signal: "tone" as const, label, contribution: 6 })),
        ...(samePlanet
          ? [{ signal: "planet" as const, label: "من الكوكب نفسه", contribution: 22 }]
          : []),
        ...(isRelated
          ? [
              {
                signal: "relationship" as const,
                label: "مرتبط مباشرةً بهذا العنوان",
                contribution: 30,
              },
            ]
          : []),
        ...(sameAudience
          ? [{ signal: "audience" as const, label: "الفئة نفسها", contribution: 5 }]
          : []),
        ...(sameKind ? [{ signal: "kind" as const, label: "الصيغة نفسها", contribution: 4 }] : []),
        ...(closeEra
          ? [{ signal: "era" as const, label: "من الفترة نفسها", contribution: 4 }]
          : []),
        ...(closeScore
          ? [{ signal: "score" as const, label: "تقييم تحريري متقارب", contribution: 6 }]
          : []),
      ];
      const rawScore = reasons.reduce((sum, reason) => sum + reason.contribution, 0);
      return {
        work: candidate,
        reasons,
        score: rawScore ? Math.min(98, Math.round(28 + rawScore * 0.7)) : 0,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function fullDetail(id: string) {
  return getTitle(id);
}
