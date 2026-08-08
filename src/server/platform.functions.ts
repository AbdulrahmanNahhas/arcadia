import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPlatformHome = createServerFn({ method: "GET" }).handler(async () => {
  const { getPlatformHomeData } = await import("@/db/platform-repository");
  return getPlatformHomeData();
});

export const getPlanets = createServerFn({ method: "GET" }).handler(async () => {
  const { listPlanets } = await import("@/db/platform-repository");
  return listPlanets();
});

export const getAdminPlanets = createServerFn({ method: "GET" }).handler(async () => {
  const { listPlanets } = await import("@/db/platform-repository");
  return listPlanets({ includeInactive: true });
});

export const getPlanetDetail = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { getPlanetBySlug } = await import("@/db/platform-repository");
    return getPlanetBySlug(data.slug);
  });

export const getPlatformWorkDetail = createServerFn({ method: "GET" })
  .validator(z.object({ workId: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const repository = await import("@/db/repository");
    const platform = await import("@/db/platform-repository");
    const work = repository.listWorks().find((item) => item.id === data.workId) ?? null;
    if (!work || !platform.isPlatformWork(work)) return null;
    return {
      work,
      structure: repository.getWorkStructure(work.id),
      tracking: repository.listWorkTrackingEntries(work.id, 50),
      planet: platform.getPlanetForWork(work.id),
      risks: platform.listRiskAssessments(work.id),
      recommendations: platform.getSimilarWorks(work.id),
    };
  });

export const searchPlatformCatalog = createServerFn({ method: "GET" })
  .validator(
    z.object({
      query: z.string().trim().max(160),
      limit: z.number().int().min(1).max(100).default(24),
    }),
  )
  .handler(async ({ data }) => {
    const { searchCatalog } = await import("@/db/platform-repository");
    return searchCatalog(data.query, data.limit);
  });

export const getSimilarWorks = createServerFn({ method: "GET" })
  .validator(
    z.object({ workId: z.string().min(1), limit: z.number().int().min(1).max(10).default(10) }),
  )
  .handler(async ({ data }) => {
    const { getSimilarWorks: findSimilarWorks } = await import("@/db/platform-repository");
    return findSimilarWorks(data.workId, data.limit);
  });

export const getCatalogValidation = createServerFn({ method: "GET" }).handler(async () => {
  const { validateCatalog } = await import("@/db/platform-repository");
  return validateCatalog();
});

export const getStudioLineage = createServerFn({ method: "GET" }).handler(async () => {
  const { listOrganizationRelationships } = await import("@/db/platform-repository");
  return listOrganizationRelationships();
});

export const getOrganizationRelationshipEditorData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { listOrganizationRelationshipEditorData } = await import("@/db/platform-repository");
    return listOrganizationRelationshipEditorData();
  },
);

const organizationRelationshipInputSchema = z
  .object({
    sourceEntityId: z.string().min(1),
    targetEntityId: z.string().min(1),
    relationshipTypeId: z.string().min(1),
    occurredOn: z
      .string()
      .regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/)
      .nullable(),
    datePrecision: z.enum(["day", "month", "year", "unknown"]),
    description: z.string().trim().min(8).max(4_000),
    notes: z.string().trim().max(4_000),
    prominence: z.number().int().min(0).max(3),
    people: z
      .array(z.object({ entityId: z.string().min(1), role: z.string().trim().min(1).max(120) }))
      .max(50),
  })
  .superRefine((value, context) => {
    if (value.sourceEntityId === value.targetEntityId) {
      context.addIssue({
        code: "custom",
        path: ["targetEntityId"],
        message: "يجب أن يختلف الطرفان.",
      });
    }
    if (value.datePrecision === "unknown" && value.occurredOn) {
      context.addIssue({
        code: "custom",
        path: ["occurredOn"],
        message: "أزل التاريخ أو حدّد دقته.",
      });
    }
    if (value.datePrecision !== "unknown" && !value.occurredOn) {
      context.addIssue({ code: "custom", path: ["occurredOn"], message: "أدخل تاريخ العلاقة." });
    }
    const expectedLength = { year: 4, month: 7, day: 10 } as const;
    if (
      value.occurredOn &&
      value.datePrecision !== "unknown" &&
      value.occurredOn.length !== expectedLength[value.datePrecision]
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurredOn"],
        message: "صيغة التاريخ لا تطابق دقته.",
      });
    }
  });

export const createOrganizationRelationship = createServerFn({ method: "POST" })
  .validator(organizationRelationshipInputSchema)
  .handler(async ({ data }) => {
    const { createOrganizationRelationship: create } = await import("@/db/platform-repository");
    return create(data);
  });

export const setWorkPlanet = createServerFn({ method: "POST" })
  .validator(
    z.object({
      workId: z.string().min(1),
      planetId: z.string().min(1),
      featuredRank: z.number().int().min(0).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { savePlanetAssignment } = await import("@/db/platform-repository");
    return savePlanetAssignment(data);
  });

const planetInputSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameAr: z.string().trim().min(2),
  nameEn: z.string().trim().nullable().optional(),
  icon: z.string().trim().min(1).max(8),
  description: z.string().trim(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  displayOrder: z.number().int().min(0),
  classificationHints: z.record(z.string(), z.array(z.string())).optional(),
  isActive: z.boolean(),
});

export const saveAdminPlanet = createServerFn({ method: "POST" })
  .validator(planetInputSchema)
  .handler(async ({ data }) => {
    const { savePlanet } = await import("@/db/platform-repository");
    return savePlanet(data);
  });

export const moveAdminWorksToPlanet = createServerFn({ method: "POST" })
  .validator(
    z.object({
      workIds: z.array(z.string().min(1)).min(1).max(5_000),
      planetId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { moveWorksToPlanet } = await import("@/db/platform-repository");
    return moveWorksToPlanet(data);
  });
