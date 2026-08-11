import {
  type AdminEntityInput,
  type AdminWorkUpdate,
  audiences,
  type EditableWorkStructure,
  genres,
  tagLabelsAr,
  taxonomyLabels,
  tones,
  type WorkStructure,
} from "@/features/library/model";
import { apiFetch } from "@/lib/api";
import {
  allAdminWorks,
  allWorks,
  detailToStructure,
  entities,
  fullAdminDetail,
  fullDetail,
} from "./compat";

type Data<T> = { data: T };
const emptyStructure = (workId: string): WorkStructure => ({
  workId,
  seasons: [],
  ungroupedUnits: [],
  completedUnits: 0,
  totalUnits: 0,
});

export const getWorks = allWorks;
export const getAdminWorks = allAdminWorks;
export const getEntities = entities;

export async function saveEntity({ data }: Data<AdminEntityInput>) {
  const saved = await apiFetch<{ id: string }>("/api/v1/admin/entities", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return {
    ...data,
    id: saved.id,
    imagePath: data.imagePath ?? null,
    primaryUrl: data.primaryUrl ?? null,
    malId: data.malId ?? null,
    anilistId: data.anilistId ?? null,
    imdbId: data.imdbId ?? null,
    wikipediaUrl: data.wikipediaUrl ?? null,
    establishedAt: data.establishedAt ?? null,
    birthDate: data.birthDate ?? null,
    deathDate: data.deathDate ?? null,
    favorites: data.favorites ?? null,
    workCount: 0,
    roles: [],
    kinds: [],
    works: [],
  };
}
export async function saveEntities({ data }: Data<{ entities: AdminEntityInput[] }>) {
  return Promise.all(data.entities.map((entity) => saveEntity({ data: entity })));
}
export async function deleteEntities({ data }: Data<{ ids: string[] }>) {
  return apiFetch<{ deleted: number }>("/api/v1/admin/entities", {
    method: "DELETE",
    body: JSON.stringify(data),
  });
}

const terms = [
  ...genres.map((key) => ({
    vocabulary: "genre",
    key,
    labelEn: key,
    labelAr: taxonomyLabels.genres[key],
  })),
  ...tones.map((key) => ({
    vocabulary: "tone",
    key,
    labelEn: key,
    labelAr: taxonomyLabels.tones[key],
  })),
  ...audiences.map((key) => ({
    vocabulary: "audience",
    key,
    labelEn: key,
    labelAr: taxonomyLabels.audiences[key],
  })),
  ...Object.entries(tagLabelsAr).map(([key, labelAr]) => ({
    vocabulary: "tag",
    key,
    labelEn: key,
    labelAr,
  })),
].map((term) => ({
  ...term,
  id: `${term.vocabulary}:${term.key}`,
  description: "",
  descriptionAr: "",
  usageCount: 0,
}));
export async function getTaxonomyTerms() {
  return terms;
}
export async function getAdminOverview() {
  return apiFetch<{
    titles: number;
    private_titles: number;
    missing_arabic: number;
    missing_posters: number;
    missing_guidance: number;
    installments: number;
    seasons: number;
    movies: number;
    specials: number;
    missing_release_dates: number;
    episodes: number;
    scored_installments: number;
    people: number;
    studios: number;
    planets: number;
    unassigned_titles: number;
    credits: number;
    relationships: number;
  }>("/api/v1/admin/overview");
}
export async function saveTaxonomyTranslation({
  data,
}: Data<{ id: string; labelAr: string | null; description: string; descriptionAr: string }>) {
  return data;
}
export async function saveTaxonomyTranslations({
  data,
}: Data<{
  translations: Array<{
    id: string;
    labelAr: string | null;
    description: string;
    descriptionAr: string;
  }>;
}>) {
  return data.translations;
}

export async function addWork({ data }: Data<Record<string, unknown>>) {
  return apiFetch<{ id: string }>("/api/v1/admin/titles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function addWorksBulk({ data }: Data<{ works: Array<Record<string, unknown>> }>) {
  return Promise.all(data.works.map((work) => addWork({ data: work })));
}
export async function saveWork({ data }: Data<AdminWorkUpdate>) {
  return apiFetch<{ id: string }>("/api/v1/admin/titles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function deleteWorks({ data }: Data<{ ids: string[] }>) {
  return apiFetch<{ deleted: number }>("/api/v1/admin/titles", {
    method: "DELETE",
    body: JSON.stringify(data),
  });
}
export async function editWorksBulk({
  data,
}: Data<{ workIds: string[] } & Record<string, unknown>>) {
  const works = await allWorks();
  return Promise.all(
    data.workIds.map((id) => {
      const work = works.find((item) => item.id === id);
      return work
        ? apiFetch("/api/v1/admin/titles", {
            method: "POST",
            body: JSON.stringify({ ...work, ...data, id }),
          })
        : null;
    }),
  );
}

export async function getWorkStructure({ data }: Data<{ workId: string }>) {
  const detail = await fullDetail(data.workId);
  return detail ? detailToStructure(detail) : emptyStructure(data.workId);
}
export async function getAdminWorkStructure({ data }: Data<{ workId: string }>) {
  const detail = await fullAdminDetail(data.workId);
  return detailToStructure(detail);
}
export async function getWorkStructures({ data }: Data<{ workIds: string[] }>) {
  return Promise.all(data.workIds.map((workId) => getWorkStructure({ data: { workId } })));
}
export async function saveWorkStructure({ data }: Data<EditableWorkStructure>) {
  return apiFetch<{ titleId: string }>(`/api/v1/admin/titles/${data.workId}/structure`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export async function addWorkSeason({ data }: Data<Record<string, unknown>>) {
  return data;
}
export async function addWorkUnit({ data }: Data<Record<string, unknown>>) {
  return data;
}

export async function uploadWorkImage({
  data,
}: Data<{ dataUrl: string; fileName: string; assetType: string; ownerName: string }>) {
  return apiFetch<{ relativePath: string; mimeType: string }>("/api/v1/admin/media", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function uploadEntityImage({ data }: Data<{ dataUrl: string; fileName: string }>) {
  return apiFetch<{ relativePath: string; mimeType: string }>("/api/v1/admin/media", {
    method: "POST",
    body: JSON.stringify({ ...data, assetType: "profile", ownerName: data.fileName }),
  });
}

export async function getAdminRecordBundles({ data }: Data<{ workIds: string[] }>) {
  const works = await allAdminWorks();
  const bundles = await Promise.all(
    data.workIds.flatMap((workId) => {
      const work = works.find((item) => item.id === workId);
      return work
        ? [
            getAdminWorkStructure({ data: { workId } }).then((structure) => ({
              work,
              structure: {
                workId: structure.workId,
                seasons: structure.seasons.map((season) => ({
                  id: season.id,
                  title: season.title,
                  installmentKind: season.installmentKind ?? "season",
                  summary: season.summary ?? "",
                  releaseStatus: season.releaseStatus ?? "unknown",
                  posterPath: season.posterPath ?? null,
                  score: season.score,
                  seasonNumber: season.seasonNumber,
                  position: season.position,
                  runtimeMinutes: season.runtimeMinutes,
                  unitCount: season.unitCount,
                  releaseAt: season.releaseAt,
                  units: season.units.map((unit) => ({
                    id: unit.id,
                    unitType: "episode" as const,
                    title: unit.title,
                    unitNumber: unit.unitNumber,
                    position: unit.position,
                    runtimeMinutes: unit.runtimeMinutes,
                    releaseAt: unit.releaseAt,
                  })),
                })),
                ungroupedUnits: [],
              } satisfies EditableWorkStructure,
            })),
          ]
        : [];
    }),
  );
  return { bundles, errors: [] as Array<{ workId: string; message: string }> };
}
export async function saveAdminRecordChanges({
  data,
}: Data<{
  changes: Array<{ workId: string; work?: AdminWorkUpdate; structure?: EditableWorkStructure }>;
}>) {
  const errors: Array<{ workId: string; message: string }> = [];
  let updated = 0;
  for (const change of data.changes)
    try {
      if (change.work) await saveWork({ data: change.work });
      if (change.structure) await saveWorkStructure({ data: change.structure });
      updated++;
    } catch (error) {
      errors.push({
        workId: change.workId,
        message: error instanceof Error ? error.message : "تعذر حفظ السجل.",
      });
    }
  return { updated, errors };
}
