import type {
  AccountPolicyPreview,
  AdminAwardCategoryInput,
  AdminAwardCeremonyInput,
  AdminAwardOrganizationInput,
  AdminAwardRecognitionInput,
  AdminAwardsDocument,
  AdminEntityContributionInput,
  AdminStatistics,
  ArtworkCandidate,
  ArtworkProvider,
  AwardOrganizationOption,
  MediaAsset,
  VocabularyTerm,
} from "@arcadia/contracts";
import type {
  AdminEntityInput,
  AdminWorkUpdate,
  EditableWorkStructure,
  WorkStructure,
} from "@/features/library/model";
import { apiFetch } from "@/lib/api";
import {
  adminEntities,
  allAdminWorks,
  allWorks,
  detailToStructure,
  entities,
  fullAdminDetail,
  fullDetail,
  searchAdminWorks as searchAdminWorksQuery,
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
export const getAdminEntities = adminEntities;

export async function searchAdminWorks({ data }: Data<{ q: string; limit?: number }>) {
  return searchAdminWorksQuery(data.q, data.limit);
}

export async function saveEntity({ data }: Data<AdminEntityInput>) {
  const saved = await apiFetch<{ id: string }>("/api/v1/admin/entities", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const refreshed = await adminEntities(data.entityType);
  const entity = refreshed.find((item) => item.id === saved.id);
  if (!entity) throw new Error("حُفظ السجل لكن تعذّر تحميله من جديد.");
  return entity;
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
export async function saveEntityContribution({
  data,
}: Data<AdminEntityContributionInput & { entityId: string }>) {
  const { entityId, ...input } = data;
  return apiFetch<{ updated: true }>(`/api/v1/admin/entities/${entityId}/contributions`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
export async function deleteEntityContribution({
  data,
}: Data<{ entityId: string; titleId: string; role: string }>) {
  const { entityId, ...input } = data;
  return apiFetch<{ deleted: number }>(`/api/v1/admin/entities/${entityId}/contributions`, {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}

export async function getTaxonomyTerms() {
  return apiFetch<VocabularyTerm[]>("/api/v1/vocabularies");
}
export async function getAdminVocabularyTerms() {
  return apiFetch<VocabularyTerm[]>("/api/v1/admin/vocabularies");
}
export async function getAdminStatistics(visibility: "all" | "public" | "private" = "all") {
  return apiFetch<AdminStatistics>(`/api/v1/admin/statistics?visibility=${visibility}`);
}
export async function getMediaAssets(query = "") {
  return apiFetch<{ items: MediaAsset[]; total: number }>(`/api/v1/admin/media-assets${query}`);
}
export async function assignMediaAsset({
  data,
}: Data<{
  assetId: string;
  role: "poster" | "banner" | "logo" | "profile";
  owner: Record<string, string>;
  isPrimary: boolean;
}>) {
  return apiFetch("/api/v1/admin/media-assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function removeMediaAssignment({ data }: Data<{ assignmentId: string }>) {
  return apiFetch<{ deleted: true }>(`/api/v1/admin/media-assignments/${data.assignmentId}`, {
    method: "DELETE",
  });
}
export async function deleteMediaAsset({ data }: Data<{ assetId: string }>) {
  return apiFetch<{ deleted: true }>(`/api/v1/admin/media-assets/${data.assetId}`, {
    method: "DELETE",
  });
}
export async function getAccountPolicyPreviews() {
  return apiFetch<AccountPolicyPreview[]>("/api/v1/admin/accounts");
}
export function getAwardOptions() {
  return apiFetch<AwardOrganizationOption[]>("/api/v1/admin/awards/options");
}
export function getAdminAwards() {
  return apiFetch<AdminAwardsDocument>("/api/v1/admin/awards");
}
export function getTitleAwardRecognitions({ data }: Data<{ titleId: string }>) {
  return apiFetch<AdminAwardsDocument["recognitions"]>(
    `/api/v1/admin/awards/recognitions?titleId=${encodeURIComponent(data.titleId)}`,
  );
}
export function saveAwardOrganization({ data }: Data<AdminAwardOrganizationInput>) {
  return apiFetch<{ id: string }>(`/api/v1/admin/awards/organizations/${data.id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export function deleteAwardOrganization({ data }: Data<{ id: string }>) {
  return apiFetch<{ deleted: number; deletedRecognitions: number }>(
    `/api/v1/admin/awards/organizations/${data.id}`,
    { method: "DELETE" },
  );
}
export function saveAwardCategory({ data }: Data<AdminAwardCategoryInput>) {
  return apiFetch<{ id: string }>(`/api/v1/admin/awards/categories/${data.id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export function deleteAwardCategory({ data }: Data<{ id: string }>) {
  return apiFetch<{ deleted: number; deletedRecognitions: number }>(
    `/api/v1/admin/awards/categories/${data.id}`,
    { method: "DELETE" },
  );
}
export function saveAwardRecognition({ data }: Data<AdminAwardRecognitionInput>) {
  return apiFetch<{ id: string }>("/api/v1/admin/awards/recognitions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function deleteAwardRecognition({ data }: Data<{ id: string }>) {
  return apiFetch<{ deleted: number }>(`/api/v1/admin/awards/recognitions/${data.id}`, {
    method: "DELETE",
  });
}
export function createAwardOrganization({
  data,
}: Data<{ slug: string; nameAr: string; nameEn: string | null; websiteUrl: string | null }>) {
  return apiFetch<{ id: string; slug: string; nameAr: string; nameEn: string | null }>(
    "/api/v1/admin/awards/organizations",
    { method: "POST", body: JSON.stringify(data) },
  );
}
export function createAwardCategory({
  data,
}: Data<{ organizationId: string; slug: string; nameAr: string; nameEn: string | null }>) {
  return apiFetch<{ id: string; slug: string; nameAr: string; nameEn: string | null }>(
    "/api/v1/admin/awards/categories",
    { method: "POST", body: JSON.stringify(data) },
  );
}
export function saveAwardCeremony({ data }: Data<AdminAwardCeremonyInput>) {
  return data.id
    ? apiFetch<{ id: string }>(`/api/v1/admin/awards/ceremonies/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
    : apiFetch<{ id: string }>("/api/v1/admin/awards/ceremonies", {
        method: "POST",
        body: JSON.stringify(data),
      });
}
export function deleteAwardCeremony({ data }: Data<{ id: string }>) {
  return apiFetch<{ deleted: number }>(`/api/v1/admin/awards/ceremonies/${data.id}`, {
    method: "DELETE",
  });
}
export async function getAdminOverview() {
  return apiFetch<{
    titles: number;
    private_titles: number;
    missing_arabic: number;
    missing_posters: number;
    media_assets: number;
    media_failures: number;
    unreferenced_assets: number;
    reused_assets: number;
    inactive_term_usage: number;
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
  const current = (await getAdminVocabularyTerms()).find((term) => term.id === data.id);
  if (!current) throw new Error("تعذّر العثور على المصطلح.");
  return apiFetch<{ id: string }>("/api/v1/admin/vocabularies", {
    method: "POST",
    body: JSON.stringify({
      ...current,
      labelAr: data.labelAr ?? current.labelAr,
      descriptionEn: data.description,
      descriptionAr: data.descriptionAr,
    }),
  });
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
  return Promise.all(
    data.translations.map((translation) => saveTaxonomyTranslation({ data: translation })),
  );
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
  const works = await allAdminWorks();
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
export async function updateMediaFocal({
  data,
}: Data<{ assetId: string; focalX: number; focalY: number }>) {
  return apiFetch<{ updated: true }>(`/api/v1/admin/media-assets/${data.assetId}/focal`, {
    method: "PATCH",
    body: JSON.stringify({ focalX: data.focalX, focalY: data.focalY }),
  });
}
export async function searchArtwork({
  data,
}: Data<{
  title: string;
  year?: number;
  kind?: "anime" | "movie";
  role: "poster" | "banner" | "logo";
  tmdbId?: number | null;
  anilistId?: number | null;
}>) {
  const params = new URLSearchParams({ title: data.title, role: data.role });
  if (data.year) params.set("year", String(data.year));
  if (data.kind) params.set("kind", data.kind);
  if (data.tmdbId) params.set("tmdbId", String(data.tmdbId));
  if (data.anilistId) params.set("anilistId", String(data.anilistId));
  return apiFetch<{ candidates: ArtworkCandidate[] }>(
    `/api/v1/admin/media-artwork-search?${params}`,
  );
}
export async function ingestArtwork({
  data,
}: Data<{
  downloadUrl: string;
  role: "poster" | "banner" | "logo";
  ownerName: string;
  owner?: Record<string, string>;
  isPrimary?: boolean;
  provider: ArtworkProvider;
  externalId: string;
  titleId?: string;
  installmentId?: string;
}>) {
  return apiFetch<{ relativePath: string; mimeType: string }>(
    "/api/v1/admin/media-artwork-ingest",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function getAdminRecordBundles({ data }: Data<{ workIds: string[] }>) {
  const works = await allAdminWorks();
  const bundles = await Promise.all(
    data.workIds.flatMap((workId) => {
      const work = works.find((item) => item.id === workId);
      return work
        ? [
            Promise.all([
              getAdminWorkStructure({ data: { workId } }),
              getTitleAwardRecognitions({ data: { titleId: workId } }),
            ]).then(([structure, recognitions]) => ({
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
                  tmdbId: season.tmdbId ?? null,
                  imdbId: season.imdbId ?? null,
                  tvdbId: season.tvdbId ?? null,
                  anilistId: season.anilistId ?? null,
                  malId: season.malId ?? null,
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
              awards: recognitions.map((recognition) => ({
                id: recognition.id,
                organizationId: recognition.organizationId ?? "",
                categoryId: recognition.categoryId ?? "",
                titleId: recognition.titleId,
                installmentId: recognition.installmentId,
                year: recognition.year,
                result: recognition.result,
                isFeatured: recognition.isFeatured,
                sourceUrl: recognition.sourceUrl,
                notes: recognition.notes,
              })),
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
  changes: Array<{
    workId: string;
    work?: AdminWorkUpdate;
    structure?: EditableWorkStructure;
    awards?: {
      toCreate: AdminAwardRecognitionInput[];
      toUpdate: AdminAwardRecognitionInput[];
      toDeleteIds: string[];
    };
  }>;
}>) {
  const errors: Array<{ workId: string; message: string }> = [];
  let updated = 0;
  for (const change of data.changes)
    try {
      if (change.work) await saveWork({ data: change.work });
      if (change.structure) await saveWorkStructure({ data: change.structure });
      if (change.awards) {
        for (const award of [...change.awards.toCreate, ...change.awards.toUpdate])
          await saveAwardRecognition({ data: award });
        for (const id of change.awards.toDeleteIds) await deleteAwardRecognition({ data: { id } });
      }
      updated++;
    } catch (error) {
      errors.push({
        workId: change.workId,
        message: error instanceof Error ? error.message : "تعذر حفظ السجل.",
      });
    }
  return { updated, errors };
}
