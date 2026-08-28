import type { FamilyActivity, PublicAwardsDocument } from "@arcadia/contracts";
import type { Work } from "@/features/library/model";
import type {
  OrganizationRelationship,
  PlanetWithWorks,
  ValidationIssue,
} from "@/features/platform/model";
import { apiFetch } from "@/lib/api";
import {
  adminPlanetsWithWorks,
  allAdminInstallmentWorks,
  allAdminWorks,
  allInstallmentWorks,
  allWorks,
  detailToStructure,
  entities,
  fullDetail,
  planetsWithWorks,
  recommendationsFor,
  titleToWork,
} from "./compat";

type Data<T> = { data: T };
export async function getPlatformHome() {
  const [works, planets, library, familyActivity] = await Promise.all([
    allWorks(),
    planetsWithWorks(),
    apiFetch<Array<{ titleId: string; isFavorite: boolean }>>("/api/v1/me/library").catch(() => []),
    apiFetch<FamilyActivity[]>("/api/v1/family/activity").catch(() => []),
  ]);
  const rated = [...works]
    .filter((work) => work.calculatedRating !== null)
    .sort((a, b) => (b.calculatedRating ?? 0) - (a.calculatedRating ?? 0));
  return {
    watchRadar: selectHeroWorks(works, library),
    // TODO(tracking): drive this from real playback progress once Phase B of
    // docs/tracking-dashboard-i18n-roadmap.md lands — status-based "continue watching" is gone.
    continueExploring: [] as Work[],
    highlyRated: rated.slice(0, 18),
    recentlyUpdated: [...works]
      .sort((left, right) => right.catalogUpdatedAt - left.catalogUpdatedAt)
      .slice(0, 18),
    planets,
    familyActivity,
  };
}

export async function getAdminWatchRadar() {
  const works = await allAdminWorks();
  return selectHeroWorks(works, []);
}

function selectHeroWorks(works: Work[], library: Array<{ titleId: string; isFavorite: boolean }>) {
  const stateById = new Map(library.map((item) => [item.titleId, item]));
  const day = Math.floor(Date.now() / 86_400_000);
  const stableNoise = (id: string) => {
    let hash = day;
    for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
    return Math.abs(hash % 19);
  };
  const ranked = [...works]
    .filter((work) => Boolean(work.bannerPath || work.imagePath))
    .map((work) => {
      const state = stateById.get(work.id);
      const releaseBoost =
        work.releaseStatus === "airing"
          ? 42
          : work.releaseStatus === "upcoming" || work.releaseStatus === "returning"
            ? 34
            : Math.max(0, (work.year ?? 0) - new Date().getFullYear() + 8) * 2;
      const personalBoost = state?.isFavorite ? 16 : 0;
      return {
        work,
        score:
          releaseBoost + personalBoost + (work.calculatedRating ?? 0) * 2 + stableNoise(work.id),
      };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ work }) => work);
  const upcoming = ranked.filter(
    (work) => work.releaseStatus === "upcoming" || work.releaseStatus === "returning",
  );
  const available = ranked.filter(
    (work) => work.releaseStatus !== "upcoming" && work.releaseStatus !== "returning",
  );
  return [...upcoming.slice(0, 5), ...available.slice(0, 5)];
}
export const getPlanets = () => planetsWithWorks();
export const getPublicAwards = () => apiFetch<PublicAwardsDocument>("/api/v1/awards");
export const getAdminPlanets = adminPlanetsWithWorks;
export async function getPlatformCatalogWorks({ data }: Data<{ query?: string }> = { data: {} }) {
  return allWorks(data.query);
}
export async function getPlatformCatalogInstallments(
  { data }: Data<{ query?: string }> = { data: {} },
) {
  return allInstallmentWorks(data.query);
}
export async function getAdminPlatformCatalogWorks() {
  return allAdminWorks();
}
export async function getAdminPlatformCatalogInstallments() {
  return allAdminInstallmentWorks();
}
export async function getAdminUnassignedPlanetWorks() {
  return (await allAdminWorks()).filter((work) => !work.planetId);
}
export async function getPlatformWorkDetail({ data }: Data<{ workId: string }>) {
  const [detail, works, planets] = await Promise.all([
    fullDetail(data.workId),
    allWorks(),
    planetsWithWorks(),
  ]);
  if (!detail) return null;
  const work = titleToWork(detail);
  const planet = planets.find((item) => item.id === work.planetId) ?? null;
  const risks = work.riskProfile
    ? Object.entries(work.riskProfile).map(([slug, level], index) => ({
        dimensionId: slug,
        slug,
        nameAr:
          slug === "sexuality"
            ? "المحتوى الجنسي"
            : slug === "behavioral"
              ? "السلوك والعنف"
              : "الموضوعات العقدية",
        nameEn: slug,
        description: "",
        displayOrder: index,
        level: level === "unknown" ? ("none" as const) : level,
        explanation: "",
        notes: "",
      }))
    : [];
  return {
    work,
    structure: detailToStructure(detail),
    tracking: [],
    planet: planet
      ? {
          planet,
          assignment: {
            workId: work.id,
            planetId: planet.id,
            source: "manual" as const,
            confidence: null,
            reviewState: "reviewed" as const,
            featuredRank: null,
          },
        }
      : null,
    risks,
    recommendations: recommendationsFor(work, works),
  };
}
export async function getSimilarWorks({ data }: Data<{ workId: string; limit?: number }>) {
  const works = await allWorks();
  const work = works.find((item) => item.id === data.workId);
  return work ? recommendationsFor(work, works, data.limit) : [];
}
export async function searchPlatformCatalog({ data }: Data<{ query: string; limit?: number }>) {
  const needle = data.query.toLocaleLowerCase();
  const [works, allEntities, planets] = await Promise.all([
    allWorks(),
    entities(),
    planetsWithWorks(),
  ]);
  return [
    ...works
      .filter(
        (item) =>
          item.title.toLocaleLowerCase().includes(needle) || item.arabicTitle?.includes(data.query),
      )
      .map((item) => ({
        type: "work" as const,
        id: item.id,
        title: item.arabicTitle || item.title,
        subtitle: item.title,
        imagePath: item.imagePath,
      })),
    ...allEntities
      .filter((item) => item.name.toLocaleLowerCase().includes(needle))
      .map((item) => ({
        type: item.entityType === "person" ? ("person" as const) : ("studio" as const),
        id: item.id,
        title: item.name,
        subtitle: item.description,
        imagePath: item.imagePath,
      })),
    ...planets
      .filter(
        (item) =>
          item.nameAr.includes(data.query) || item.nameEn?.toLocaleLowerCase().includes(needle),
      )
      .map((item) => ({
        type: "planet" as const,
        id: item.id,
        slug: item.slug,
        title: item.nameAr,
        subtitle: item.nameEn ?? "",
        icon: item.icon,
      })),
  ].slice(0, data.limit ?? 24);
}
export async function getCatalogValidation(): Promise<ValidationIssue[]> {
  return apiFetch<ValidationIssue[]>("/api/v1/admin/validation");
}

type RelationRow = {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  occurredOn: string | null;
  description: string;
};
export async function getStudioLineage(): Promise<OrganizationRelationship[]> {
  const [rows, allEntities] = await Promise.all([
    apiFetch<RelationRow[]>("/api/v1/organization-relationships").catch(() => []),
    entities(),
  ]);
  return rows.flatMap((row) => {
    const source = allEntities.find((item) => item.id === row.sourceId);
    const target = allEntities.find((item) => item.id === row.targetId);
    return source && target
      ? [
          {
            id: row.id,
            source,
            target,
            type: {
              id: row.relationType,
              nameAr: row.relationType,
              nameEn: row.relationType,
              inverseNameAr: null,
              category: "historical" as const,
              isDirected: true,
              allowsCycles: false,
            },
            occurredOn: row.occurredOn,
            datePrecision: row.occurredOn ? ("day" as const) : ("unknown" as const),
            description: row.description,
            notes: "",
            prominence: 1,
            people: [],
          },
        ]
      : [];
  });
}
export async function getOrganizationRelationshipEditorData() {
  const allEntities = await entities();
  return {
    entities: allEntities,
    types: [
      {
        id: "successor",
        nameAr: "امتداد / خليفة",
        nameEn: "Successor",
        inverseNameAr: "سلف",
        category: "historical" as const,
        isDirected: true,
        allowsCycles: false,
      },
    ],
  };
}
export async function createOrganizationRelationship({ data }: Data<Record<string, unknown>>) {
  return apiFetch("/api/v1/admin/organization-relationships", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function setWorkPlanet({ data }: Data<{ workId: string; planetId: string }>) {
  return apiFetch("/api/v1/admin/planet-assignments", {
    method: "PUT",
    body: JSON.stringify({ workIds: [data.workId], planetId: data.planetId }),
  });
}
export async function saveAdminPlanet({
  data,
}: Data<Omit<PlanetWithWorks, "id" | "works" | "workCount" | "reviewCount"> & { id?: string }>) {
  const saved = await apiFetch<{ id: string }>("/api/v1/admin/planets", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return { ...data, id: saved.id, works: [], workCount: 0, reviewCount: 0 } as PlanetWithWorks;
}
export async function moveAdminWorksToPlanet({
  data,
}: Data<{ workIds: string[]; planetId: string | null }>) {
  return apiFetch("/api/v1/admin/planet-assignments", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
