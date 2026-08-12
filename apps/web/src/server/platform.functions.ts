import type {
  OrganizationRelationship,
  PlanetWithWorks,
  ValidationIssue,
} from "@/features/platform/model";
import { apiFetch } from "@/lib/api";
import {
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
  const [works, planets] = await Promise.all([allWorks(), planetsWithWorks()]);
  const rated = [...works]
    .filter((work) => work.calculatedRating !== null)
    .sort((a, b) => (b.calculatedRating ?? 0) - (a.calculatedRating ?? 0));
  const worksById = new Map(works.map((work) => [work.id, work]));
  return {
    watchRadar: watchRadarTitleIds.flatMap((id) => {
      const work = worksById.get(id);
      return work ? [work] : [];
    }),
    continueExploring: [],
    highlyRated: rated.slice(0, 18),
    recentlyUpdated: works.slice(-18).reverse(),
    planets,
  };
}

export async function getAdminWatchRadar() {
  const works = await allAdminWorks();
  const worksById = new Map(works.map((work) => [work.id, work]));
  return watchRadarTitleIds.flatMap((id) => {
    const work = worksById.get(id);
    return work ? [work] : [];
  });
}

const watchRadarTitleIds = [
  "b9bff940-6a81-45e1-b163-db9bf2f83918", // Kagurabachi
  "e75348fd-43c0-437d-a2c9-ce2d0d9d39ec", // Vivy -Fluorite Eye's Song-
  "b923f224-5034-4e1e-bcbd-8d93ca0afa4f", // LONA
  "e8567c80-208c-47e8-8eac-538247d6bb6f", // 86 EIGHTY-SIX
  "0b53166a-db33-4b94-ba71-85cd5e645cb9", // The Bugle Call: Song of War
  "ffe31844-fcf1-432e-8b0a-2e30f11a91c3", // PLUTO
  "54c1da35-b596-4eba-b021-930014990392", // The One Piece
  "616be2ac-19c7-4b42-ac22-70198b67b5e7", // Gachiakuta (admin-only while private)
] as const;
export const getPlanets = () => planetsWithWorks();
export const getAdminPlanets = () => planetsWithWorks(true);
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
  return (await allWorks()).filter((work) => !work.planetId);
}
export async function getPlanetDetail({ data }: Data<{ slug: string }>) {
  return (await planetsWithWorks(true)).find((planet) => planet.slug === data.slug) ?? null;
}
export async function getPlatformWorkDetail({ data }: Data<{ workId: string }>) {
  const [detail, works, planets] = await Promise.all([
    fullDetail(data.workId),
    allWorks(),
    planetsWithWorks(true),
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
  return [];
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
}: Data<{ workIds: string[]; planetId: string }>) {
  return apiFetch("/api/v1/admin/planet-assignments", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
