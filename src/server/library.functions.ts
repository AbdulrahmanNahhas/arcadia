import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  adminEntityInputSchema,
  adminRecordChangeSchema,
  adminWorkUpdateSchema,
  bulkCreateWorkSchema,
  bulkUpdateWorksSchema,
  createSavedUserViewSchema,
  createWorkSchema,
  editableWorkStructureSchema,
  recordTrackingEntrySchema,
  trackingPageInputSchema,
  updateSavedUserViewSchema,
} from "@/features/library/model";

export const getWorks = createServerFn({ method: "GET" }).handler(async () => {
  const { listWorks } = await import("@/db/repository");
  return listWorks();
});

export const getEntities = createServerFn({ method: "GET" }).handler(async () => {
  const { listEntities } = await import("@/db/repository");
  return listEntities();
});

export const saveEntity = createServerFn({ method: "POST" })
  .validator(adminEntityInputSchema)
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    return repository.saveEntity(data);
  });

export const saveEntities = createServerFn({ method: "POST" })
  .validator(z.object({ entities: z.array(adminEntityInputSchema).min(1).max(1_000) }))
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    return data.entities.map((entity) => repository.saveEntity(entity));
  });

export const deleteEntities = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string().min(1)).min(1).max(1_000) }))
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    return repository.deleteEntities(data.ids);
  });

export const getTaxonomyTerms = createServerFn({ method: "GET" }).handler(async () => {
  const { listTaxonomyTerms } = await import("@/db/repository");
  return listTaxonomyTerms();
});

export const saveTaxonomyTranslation = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      labelAr: z.string().nullable(),
      description: z.string(),
      descriptionAr: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { updateTaxonomyTranslation } = await import("@/db/repository");
    return updateTaxonomyTranslation(data);
  });

export const saveTaxonomyTranslations = createServerFn({ method: "POST" })
  .validator(
    z.object({
      translations: z
        .array(
          z.object({
            id: z.string().min(1),
            labelAr: z.string().nullable(),
            description: z.string(),
            descriptionAr: z.string(),
          }),
        )
        .min(1)
        .max(10_000),
    }),
  )
  .handler(async ({ data }) => {
    const { updateTaxonomyTranslations } = await import("@/db/repository");
    return updateTaxonomyTranslations(data.translations);
  });

export const getTrackingPage = createServerFn({ method: "GET" })
  .validator(trackingPageInputSchema)
  .handler(async ({ data }) => {
    const { listTrackingPage } = await import("@/db/repository");
    return listTrackingPage(data);
  });

export const getWorkTrackingEntries = createServerFn({ method: "GET" })
  .validator(
    z.object({
      workId: z.string().min(1),
      limit: z.number().int().min(1).max(10_000).default(200),
    }),
  )
  .handler(async ({ data }) => {
    const { listWorkTrackingEntries } = await import("@/db/repository");
    return listWorkTrackingEntries(data.workId, data.limit);
  });

export const getTrackingBaseline = createServerFn({ method: "GET" })
  .validator(
    z.object({
      workId: z.string().min(1),
      occurredOn: recordTrackingEntrySchema.shape.occurredOn,
    }),
  )
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    return repository.getTrackingBaseline(data.workId, data.occurredOn);
  });

export const recordTracking = createServerFn({ method: "POST" })
  .validator(recordTrackingEntrySchema)
  .handler(async ({ data }) => {
    const { recordTrackingEntry } = await import("@/db/repository");
    return recordTrackingEntry(data);
  });

export const removeTrackingEntry = createServerFn({ method: "POST" })
  .validator(z.object({ entryId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    return repository.removeTrackingEntry(data.entryId);
  });

export const addWork = createServerFn({ method: "POST" })
  .validator(createWorkSchema)
  .handler(async ({ data }) => {
    const { createWork } = await import("@/db/repository");
    return createWork(data);
  });

export const setWorkFavorite = createServerFn({ method: "POST" })
  .validator(z.object({ workId: z.string(), favorite: z.boolean() }))
  .handler(async ({ data }) => {
    const { updateFavorite } = await import("@/db/repository");
    return updateFavorite(data.workId, data.favorite);
  });

export const saveWork = createServerFn({ method: "POST" })
  .validator(adminWorkUpdateSchema)
  .handler(async ({ data }) => {
    const { updateWork } = await import("@/db/repository");
    return updateWork(data);
  });

export const addWorksBulk = createServerFn({ method: "POST" })
  .validator(bulkCreateWorkSchema)
  .handler(async ({ data }) => {
    const { createWorksBulk } = await import("@/db/repository");
    return createWorksBulk(data.works);
  });

export const editWorksBulk = createServerFn({ method: "POST" })
  .validator(bulkUpdateWorksSchema)
  .handler(async ({ data }) => {
    const { updateWorksBulk } = await import("@/db/repository");
    return updateWorksBulk(data);
  });

export const getSavedViews = createServerFn({ method: "GET" }).handler(async () => {
  const { listSavedViews } = await import("@/db/repository");
  return listSavedViews();
});

export const addSavedView = createServerFn({ method: "POST" })
  .validator(createSavedUserViewSchema)
  .handler(async ({ data }) => {
    const { createSavedView } = await import("@/db/repository");
    return createSavedView(data);
  });

export const editSavedView = createServerFn({ method: "POST" })
  .validator(updateSavedUserViewSchema)
  .handler(async ({ data }) => {
    const { updateSavedView } = await import("@/db/repository");
    return updateSavedView(data);
  });

export const removeSavedView = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { deleteSavedView } = await import("@/db/repository");
    return deleteSavedView(data.id);
  });

const workSeasonInputSchema = z.object({
  workId: z.string(),
  title: z.string().trim().min(1),
  seasonNumber: z.number().nullable().optional(),
  position: z.number().int().min(0),
  runtimeMinutes: z.number().int().min(0).nullable().optional(),
  unitCount: z.number().int().min(0).nullable().optional(),
  releaseAt: z.number().int().nullable().optional(),
});

const workUnitInputSchema = z.object({
  workId: z.string(),
  seasonId: z.string().nullable().optional(),
  unitType: z.enum(["episode", "chapter", "volume"]),
  title: z.string().trim().nullable().optional(),
  unitNumber: z.number().nullable().optional(),
  position: z.number().int().min(0),
  runtimeMinutes: z.number().int().min(0).nullable().optional(),
  pageCount: z.number().int().min(0).nullable().optional(),
  releaseAt: z.number().int().nullable().optional(),
});

export const addWorkSeason = createServerFn({ method: "POST" })
  .validator(workSeasonInputSchema)
  .handler(async ({ data }) => {
    const { createWorkSeason } = await import("@/db/repository");
    return createWorkSeason(data);
  });

export const addWorkUnit = createServerFn({ method: "POST" })
  .validator(workUnitInputSchema)
  .handler(async ({ data }) => {
    const { createWorkUnit } = await import("@/db/repository");
    return createWorkUnit(data);
  });

export const getWorkStructure = createServerFn({ method: "GET" })
  .validator(z.object({ workId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    return repository.getWorkStructure(data.workId);
  });

export const getWorkStructures = createServerFn({ method: "POST" })
  .validator(z.object({ workIds: z.array(z.string().min(1)).max(1_000) }))
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    return data.workIds.map((workId) => repository.getWorkStructure(workId));
  });

export const getAdminRecordBundles = createServerFn({ method: "POST" })
  .validator(z.object({ workIds: z.array(z.string()).min(1).max(5_000) }))
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    const worksById = new Map(repository.listWorks().map((work) => [work.id, work]));
    const bundles: Array<{
      work: ReturnType<typeof repository.listWorks>[number];
      structure: ReturnType<typeof repository.getEditableWorkStructure>;
      tracking: ReturnType<typeof repository.listWorkTrackingEntries>;
    }> = [];
    const errors: Array<{ workId: string; message: string }> = [];
    for (const workId of data.workIds) {
      const work = worksById.get(workId);
      if (!work) {
        errors.push({ workId, message: "لم يعد العمل موجوداً." });
        continue;
      }
      try {
        bundles.push({
          work,
          structure: repository.getEditableWorkStructure(workId),
          tracking: repository.listWorkTrackingEntries(workId, 10_000),
        });
      } catch (error) {
        errors.push({
          workId,
          message: error instanceof Error ? error.message : "تعذر تحميل السجل.",
        });
      }
    }
    return { bundles, errors };
  });

export const saveAdminRecordChanges = createServerFn({ method: "POST" })
  .validator(
    z.object({
      changes: z.array(adminRecordChangeSchema).min(1).max(5_000),
    }),
  )
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    const errors: Array<{ workId: string; message: string }> = [];
    let updated = 0;
    for (const change of data.changes) {
      try {
        if (change.work && change.work.id !== change.workId) {
          throw new Error("معرّف العمل لا يطابق السجل المطلوب.");
        }
        if (change.structure?.workId !== undefined && change.structure.workId !== change.workId) {
          throw new Error("معرّف بنية العمل لا يطابق السجل المطلوب.");
        }
        if (change.work) repository.updateWork(change.work);
        if (change.structure) repository.replaceWorkStructure(change.structure);
        updated++;
      } catch (error) {
        errors.push({
          workId: change.workId,
          message: error instanceof Error ? error.message : "تعذر حفظ السجل.",
        });
      }
    }
    return { updated, errors };
  });

export const saveWorkStructure = createServerFn({ method: "POST" })
  .validator(editableWorkStructureSchema)
  .handler(async ({ data }) => {
    const { replaceWorkStructure } = await import("@/db/repository");
    return replaceWorkStructure(data);
  });
