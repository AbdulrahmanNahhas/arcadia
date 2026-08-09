import { and, asc, eq, or } from "drizzle-orm";
import type { Work } from "@/features/library/model";
import type {
  CatalogSearchResult,
  OrganizationRelationship,
  Planet,
  PlanetAssignment,
  PlanetWithWorks,
  PlatformHomeData,
  Recommendation,
  RecommendationReason,
  RiskAssessment,
  ValidationIssue,
} from "@/features/platform/model";
import { db } from "./client";
import { listEntities, listWorks } from "./repository";
import {
  assets,
  entities,
  entityRelationshipPeople,
  entityRelationships,
  organizationRelationshipTypes,
  planets,
  riskDimensions,
  searchDocuments,
  workPlanetAssignments,
  workRiskAssessments,
  works as worksTable,
} from "./schema";

const platformKinds = new Set<Work["kind"]>(["movie", "series", "anime"]);

export function isPlatformWork(work: Work) {
  return platformKinds.has(work.kind) && !work.isPrivate;
}

export function listPlanetAssignments(): PlanetAssignment[] {
  return db
    .select()
    .from(workPlanetAssignments)
    .all()
    .map((assignment) => ({
      workId: assignment.workId,
      planetId: assignment.planetId,
      source: assignment.source as PlanetAssignment["source"],
      confidence: assignment.confidence,
      reviewState: assignment.reviewState as PlanetAssignment["reviewState"],
      featuredRank: assignment.featuredRank,
    }));
}

export function listPlanets(
  options: { previewLimit?: number; includeInactive?: boolean } = {},
): PlanetWithWorks[] {
  const catalog = listWorks().filter(isPlatformWork);
  const worksById = new Map(catalog.map((work) => [work.id, work]));
  const assignments = listPlanetAssignments();
  const assignmentsByPlanet = groupBy(assignments, (assignment) => assignment.planetId);
  const previewLimit = options.previewLimit ?? Number.POSITIVE_INFINITY;

  const planetRows = options.includeInactive
    ? db.select().from(planets).orderBy(asc(planets.displayOrder)).all()
    : db
        .select()
        .from(planets)
        .where(eq(planets.isActive, true))
        .orderBy(asc(planets.displayOrder))
        .all();

  return planetRows
    .map((planet) => {
      const planetAssignments = assignmentsByPlanet.get(planet.id) ?? [];
      const planetWorks = planetAssignments
        .map((assignment) => worksById.get(assignment.workId))
        .filter((work): work is Work => Boolean(work))
        .sort(compareNewestRelease)
        .slice(0, previewLimit);
      return {
        id: planet.id,
        slug: planet.slug,
        nameAr: planet.nameAr,
        nameEn: planet.nameEn,
        icon: planet.icon,
        description: planet.description,
        primaryColor: planet.primaryColor,
        secondaryColor: planet.secondaryColor,
        displayOrder: planet.displayOrder,
        classificationHints: planet.classificationHints,
        isActive: planet.isActive,
        workCount: planetAssignments.filter((assignment) => worksById.has(assignment.workId))
          .length,
        reviewCount: planetAssignments.filter(
          (assignment) =>
            assignment.reviewState === "needs-review" && worksById.has(assignment.workId),
        ).length,
        works: planetWorks,
      } satisfies PlanetWithWorks;
    })
    .sort(
      (left, right) => right.workCount - left.workCount || left.displayOrder - right.displayOrder,
    );
}

export function savePlanet(input: {
  id?: string;
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  icon: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  displayOrder: number;
  classificationHints?: Record<string, string[]>;
  isActive: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  const id = input.id ?? crypto.randomUUID();
  db.insert(planets)
    .values({
      id,
      slug: input.slug,
      nameAr: input.nameAr,
      nameEn: input.nameEn ?? null,
      icon: input.icon,
      description: input.description,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      displayOrder: input.displayOrder,
      classificationHints: input.classificationHints ?? {},
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: planets.id,
      set: {
        slug: input.slug,
        nameAr: input.nameAr,
        nameEn: input.nameEn ?? null,
        icon: input.icon,
        description: input.description,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        displayOrder: input.displayOrder,
        classificationHints: input.classificationHints ?? {},
        isActive: input.isActive,
        updatedAt: now,
      },
    })
    .run();
  upsertPlanetSearchDocument(id);
  return listPlanets({ includeInactive: true }).find((planet) => planet.id === id) ?? null;
}

export function moveWorksToPlanet(input: { workIds: string[]; planetId: string }) {
  const target = db.select().from(planets).where(eq(planets.id, input.planetId)).get();
  if (!target?.isActive) throw new Error("الكوكب الهدف غير متاح.");
  const eligibleIds = new Set(
    listWorks()
      .filter(isPlatformWork)
      .map((work) => work.id),
  );
  const uniqueIds = [...new Set(input.workIds)];
  if (uniqueIds.some((workId) => !eligibleIds.has(workId))) {
    throw new Error("تتضمن المجموعة عملاً غير مؤهل للكواكب.");
  }
  const now = Math.floor(Date.now() / 1000);
  db.transaction((tx) => {
    for (const workId of uniqueIds) {
      tx.insert(workPlanetAssignments)
        .values({
          workId,
          planetId: input.planetId,
          source: "manual",
          reviewState: "reviewed",
          confidence: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: workPlanetAssignments.workId,
          set: {
            planetId: input.planetId,
            source: "manual",
            reviewState: "reviewed",
            confidence: null,
            updatedAt: now,
          },
        })
        .run();
    }
  });
  return { planetId: input.planetId, moved: uniqueIds.length };
}

function upsertPlanetSearchDocument(planetId: string) {
  const planet = db.select().from(planets).where(eq(planets.id, planetId)).get();
  if (!planet) return;
  db.insert(searchDocuments)
    .values({
      id: `planet:${planet.id}`,
      entityType: "planet",
      entityId: planet.id,
      primaryText: planet.nameAr,
      secondaryText: planet.nameEn ?? "",
      keywords: `${planet.description} ${Object.values(planet.classificationHints).flat().join(" ")}`,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .onConflictDoUpdate({
      target: searchDocuments.id,
      set: {
        primaryText: planet.nameAr,
        secondaryText: planet.nameEn ?? "",
        keywords: `${planet.description} ${Object.values(planet.classificationHints).flat().join(" ")}`,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    })
    .run();
}

export function getPlanetBySlug(slug: string): PlanetWithWorks | null {
  return listPlanets().find((planet) => planet.slug === slug) ?? null;
}

export function getPlanetForWork(
  workId: string,
): { planet: Planet; assignment: PlanetAssignment } | null {
  const assignment = listPlanetAssignments().find((item) => item.workId === workId);
  if (!assignment) return null;
  const planet = listPlanets({ previewLimit: 0 }).find((item) => item.id === assignment.planetId);
  return planet ? { planet, assignment } : null;
}

export function savePlanetAssignment(input: {
  workId: string;
  planetId: string;
  featuredRank?: number | null;
}) {
  const work = db.select().from(worksTable).where(eq(worksTable.id, input.workId)).get();
  if (!work || !platformKinds.has(work.kind as Work["kind"])) {
    throw new Error("يمكن إسناد الكواكب إلى الأفلام والمسلسلات والأنمي فقط.");
  }
  const planet = db.select().from(planets).where(eq(planets.id, input.planetId)).get();
  if (!planet?.isActive) throw new Error("الكوكب المطلوب غير متاح.");
  const now = Math.floor(Date.now() / 1000);
  db.insert(workPlanetAssignments)
    .values({
      workId: input.workId,
      planetId: input.planetId,
      source: "manual",
      reviewState: "reviewed",
      confidence: null,
      featuredRank: input.featuredRank ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: workPlanetAssignments.workId,
      set: {
        planetId: input.planetId,
        source: "manual",
        reviewState: "reviewed",
        confidence: null,
        featuredRank: input.featuredRank ?? null,
        updatedAt: now,
      },
    })
    .run();
  return getPlanetForWork(input.workId);
}

export function listRiskAssessments(workId: string): RiskAssessment[] {
  return db
    .select({ dimension: riskDimensions, assessment: workRiskAssessments })
    .from(riskDimensions)
    .innerJoin(
      workRiskAssessments,
      and(
        eq(workRiskAssessments.dimensionId, riskDimensions.id),
        eq(workRiskAssessments.workId, workId),
      ),
    )
    .where(eq(riskDimensions.isActive, true))
    .orderBy(asc(riskDimensions.displayOrder))
    .all()
    .map(({ dimension, assessment }) => ({
      dimensionId: dimension.id,
      slug: dimension.slug,
      nameAr: dimension.nameAr,
      nameEn: dimension.nameEn,
      description: dimension.description,
      displayOrder: dimension.displayOrder,
      level: assessment.level as RiskAssessment["level"],
      explanation: assessment.explanation,
      notes: assessment.notes,
    }));
}

export function getPlatformHomeData(): PlatformHomeData {
  const catalog = listWorks().filter(isPlatformWork);
  const featured = [...catalog]
    .filter((work) => work.bannerPath && work.logoPath && work.imagePath)
    .sort((left, right) => right.addedAt - left.addedAt)
    .slice(0, 10);
  return {
    featured,
    continueExploring: catalog.filter((work) => work.status === "in-progress").slice(0, 12),
    recentlyAdded: [...catalog].sort((a, b) => b.addedAt - a.addedAt).slice(0, 14),
    highlyRated: [...catalog]
      .filter((work) => work.calculatedRating !== null)
      .sort((a, b) => (b.calculatedRating ?? 0) - (a.calculatedRating ?? 0))
      .slice(0, 14),
    recentlyUpdated: [...catalog]
      .sort((a, b) => b.catalogUpdatedAt - a.catalogUpdatedAt)
      .slice(0, 14),
    planets: listPlanets({ previewLimit: 12 }),
  };
}

export function searchCatalog(query: string, limit = 24): CatalogSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const works = listWorks();
  const workById = new Map(works.map((work) => [work.id, work]));
  const entityById = new Map(listEntities().map((entity) => [entity.id, entity]));
  const planetById = new Map(listPlanets({ previewLimit: 0 }).map((planet) => [planet.id, planet]));
  return db
    .select()
    .from(searchDocuments)
    .all()
    .map((document) => ({ document, score: fuzzyScore(normalizedQuery, document) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(Math.max(limit, 1), 100))
    .flatMap(({ document }): CatalogSearchResult[] => {
      if (document.entityType === "work") {
        const work = workById.get(document.entityId);
        if (!work) return [];
        return [
          {
            type: "work",
            id: work.id,
            title: work.arabicTitle || work.title,
            subtitle: `${work.title} · ${work.year ?? "—"}`,
            imagePath: work.imagePath,
          },
        ];
      }
      if (document.entityType === "planet") {
        const planet = planetById.get(document.entityId);
        if (!planet) return [];
        return [
          {
            type: "planet",
            id: planet.id,
            slug: planet.slug,
            title: planet.nameAr,
            subtitle: planet.nameEn ?? `${planet.workCount} عمل`,
            icon: planet.icon,
          },
        ];
      }
      const entity = entityById.get(document.entityId);
      if (!entity) return [];
      return [
        {
          type: document.entityType as "person" | "studio",
          id: entity.id,
          title: entity.name,
          subtitle: document.entityType === "person" ? "شخص" : "استوديو أو جهة",
          imagePath: entity.imagePath,
        },
      ];
    });
}

export function getSimilarWorks(workId: string, limit = 10): Recommendation[] {
  const catalog = listWorks().filter(isPlatformWork);
  const source = catalog.find((work) => work.id === workId);
  if (!source) return [];
  const assignments = new Map(listPlanetAssignments().map((item) => [item.workId, item.planetId]));
  const tagFrequency = valueFrequency(catalog, (work) => work.tags);
  const genreFrequency = valueFrequency(catalog, (work) => work.genres);
  return catalog
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) =>
      recommendationFor(
        source,
        candidate,
        assignments,
        tagFrequency,
        genreFrequency,
        catalog.length,
      ),
    )
    .filter((recommendation) => recommendation.score > 0)
    .sort((left, right) => right.score - left.score || compareNewestRelease(left.work, right.work))
    .slice(0, Math.min(Math.max(limit, 1), 10));
}

export function listOrganizationRelationshipEditorData() {
  return {
    entities: listEntities().filter(
      (entity) => entity.entityType === "organization" || entity.entityType === "person",
    ),
    types: db
      .select()
      .from(organizationRelationshipTypes)
      .where(eq(organizationRelationshipTypes.isActive, true))
      .orderBy(
        asc(organizationRelationshipTypes.displayOrder),
        asc(organizationRelationshipTypes.nameAr),
      )
      .all(),
  };
}

export function createOrganizationRelationship(input: {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipTypeId: string;
  occurredOn: string | null;
  datePrecision: "day" | "month" | "year" | "unknown";
  description: string;
  notes: string;
  prominence: number;
  people: Array<{ entityId: string; role: string }>;
}) {
  if (input.sourceEntityId === input.targetEntityId) {
    throw new Error("لا يمكن ربط الكيان بنفسه.");
  }

  return db.transaction((tx) => {
    const [source, target, type] = [
      tx.select().from(entities).where(eq(entities.id, input.sourceEntityId)).get(),
      tx.select().from(entities).where(eq(entities.id, input.targetEntityId)).get(),
      tx
        .select()
        .from(organizationRelationshipTypes)
        .where(
          and(
            eq(organizationRelationshipTypes.id, input.relationshipTypeId),
            eq(organizationRelationshipTypes.isActive, true),
          ),
        )
        .get(),
    ];
    if (source?.entityType !== "organization") {
      throw new Error("اختر استوديو أو منظمة صالحة كمصدر.");
    }
    if (target?.entityType !== "organization") {
      throw new Error("اختر استوديو أو منظمة صالحة كهدف.");
    }
    if (!type) throw new Error("نوع العلاقة غير متاح.");

    const people = [...new Map(input.people.map((person) => [person.entityId, person])).values()];
    if (people.length !== input.people.length) {
      throw new Error("لا يمكن إرفاق الشخص نفسه أكثر من مرة.");
    }
    if (people.length) {
      const peopleById = new Map(
        tx
          .select()
          .from(entities)
          .where(or(...people.map((person) => eq(entities.id, person.entityId))))
          .all()
          .map((person) => [person.id, person]),
      );
      if (people.some((person) => peopleById.get(person.entityId)?.entityType !== "person")) {
        throw new Error("لا يمكن إرفاق سوى كيانات الأشخاص بالعلاقة.");
      }
    }

    const existing = tx
      .select()
      .from(entityRelationships)
      .where(eq(entityRelationships.relationshipTypeId, type.id))
      .all();
    const isDuplicate = existing.some(
      (relationship) =>
        relationship.occurredOn === input.occurredOn &&
        (type.isDirected
          ? relationship.sourceEntityId === input.sourceEntityId &&
            relationship.targetEntityId === input.targetEntityId
          : (relationship.sourceEntityId === input.sourceEntityId &&
              relationship.targetEntityId === input.targetEntityId) ||
            (relationship.sourceEntityId === input.targetEntityId &&
              relationship.targetEntityId === input.sourceEntityId)),
    );
    if (isDuplicate) throw new Error("هذه العلاقة مسجلة بالفعل بالتاريخ نفسه.");

    if (type.isDirected && !type.allowsCycles) {
      const adjacency = new Map<string, string[]>();
      for (const relationship of existing) {
        const targets = adjacency.get(relationship.sourceEntityId) ?? [];
        targets.push(relationship.targetEntityId);
        adjacency.set(relationship.sourceEntityId, targets);
      }
      const visited = new Set<string>();
      const pending = [input.targetEntityId];
      while (pending.length) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === input.sourceEntityId) {
          throw new Error("هذه العلاقة ستنشئ دورة غير مسموح بها لهذا النوع.");
        }
        visited.add(current);
        pending.push(...(adjacency.get(current) ?? []));
      }
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    tx.insert(entityRelationships)
      .values({
        id,
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
        relationshipTypeId: type.id,
        occurredOn: input.occurredOn,
        datePrecision: input.datePrecision,
        description: input.description,
        notes: input.notes,
        prominence: input.prominence,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    if (people.length) {
      tx.insert(entityRelationshipPeople)
        .values(
          people.map((person, position) => ({
            relationshipId: id,
            entityId: person.entityId,
            role: person.role,
            position,
          })),
        )
        .run();
    }
    return id;
  });
}

export function listOrganizationRelationships(): OrganizationRelationship[] {
  const entityById = new Map(listEntities().map((entity) => [entity.id, entity]));
  const types = new Map(
    db
      .select()
      .from(organizationRelationshipTypes)
      .all()
      .map((type) => [type.id, type]),
  );
  const peopleByRelationship = groupBy(
    db.select().from(entityRelationshipPeople).all(),
    (person) => person.relationshipId,
  );
  return db
    .select()
    .from(entityRelationships)
    .all()
    .flatMap((relationship): OrganizationRelationship[] => {
      const source = entityById.get(relationship.sourceEntityId);
      const target = entityById.get(relationship.targetEntityId);
      const type = types.get(relationship.relationshipTypeId);
      if (!source || !target || !type) return [];
      return [
        {
          id: relationship.id,
          source,
          target,
          type: {
            id: type.id,
            nameAr: type.nameAr,
            nameEn: type.nameEn,
            inverseNameAr: type.inverseNameAr,
            category: type.category as OrganizationRelationship["type"]["category"],
            isDirected: type.isDirected,
            allowsCycles: type.allowsCycles,
          },
          occurredOn: relationship.occurredOn,
          datePrecision: relationship.datePrecision as OrganizationRelationship["datePrecision"],
          description: relationship.description,
          notes: relationship.notes,
          prominence: relationship.prominence,
          people: (peopleByRelationship.get(relationship.id) ?? [])
            .flatMap((person) => {
              const entity = entityById.get(person.entityId);
              return entity ? [{ entity, role: person.role, position: person.position }] : [];
            })
            .sort((left, right) => left.position - right.position),
        },
      ];
    });
}

export function validateCatalog(): ValidationIssue[] {
  const catalog = listWorks();
  const entityCatalog = listEntities();
  const assignments = listPlanetAssignments();
  const assignmentByWork = new Map(
    assignments.map((assignment) => [assignment.workId, assignment]),
  );
  const issues: ValidationIssue[] = [];
  for (const work of catalog) {
    if (isPlatformWork(work) && !assignmentByWork.has(work.id)) {
      issues.push(
        issue(
          "error",
          "work",
          work.id,
          work.title,
          "planet",
          "لا يملك العمل كوكباً أساسياً.",
          "عيّن كوكباً من إدارة الكواكب.",
        ),
      );
    }
    if (!isPlatformWork(work) && assignmentByWork.has(work.id)) {
      issues.push(
        issue(
          "warning",
          "work",
          work.id,
          work.title,
          "planet",
          "نوع العمل غير مؤهل للمنصة الرئيسية لكنه مرتبط بكوكب.",
          "أزل الإسناد أو غيّر نوع العمل.",
        ),
      );
    }
    if (!work.summary.trim()) {
      issues.push(
        issue(
          "warning",
          "work",
          work.id,
          work.title,
          "summary",
          "الملخص فارغ.",
          "أضف ملخصاً موجزاً.",
        ),
      );
    }
    for (const [path, value] of [
      ["releaseStart", work.releaseStart],
      ["releaseEnd", work.releaseEnd],
    ] as const) {
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        issues.push(
          issue(
            "error",
            "work",
            work.id,
            work.title,
            path,
            "صيغة التاريخ غير صحيحة.",
            "استخدم YYYY-MM-DD.",
          ),
        );
      }
    }
  }
  for (const entity of entityCatalog) {
    if (!entity.description.trim()) {
      issues.push(
        issue(
          "info",
          entity.entityType === "person" ? "person" : "studio",
          entity.id,
          entity.name,
          "description",
          "لا يوجد وصف تحريري لهذا السجل.",
          "أضف وصفاً عند توفر معلومات موثوقة.",
        ),
      );
    }
  }
  const entityIds = new Set(entityCatalog.map((entity) => entity.id));
  const workIds = new Set(catalog.map((work) => work.id));
  for (const asset of db.select().from(assets).all()) {
    const valid =
      (asset.ownerType === "work" && workIds.has(asset.ownerId)) ||
      (asset.ownerType === "entity" && entityIds.has(asset.ownerId)) ||
      (asset.ownerType === "planet" &&
        listPlanets({ previewLimit: 0 }).some((planet) => planet.id === asset.ownerId));
    if (!valid) {
      issues.push(
        issue(
          "error",
          "asset",
          asset.id,
          asset.relativePath,
          "ownerId",
          "الأصل مرتبط بسجل غير موجود.",
          "صحح المالك أو احذف الأصل بعد المراجعة.",
        ),
      );
    }
  }
  return issues;
}

function groupBy<Item, Key>(items: Item[], keyFor: (item: Item) => Key) {
  const groups = new Map<Key, Item[]>();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function compareNewestRelease(left: Work, right: Work) {
  return releaseTimestamp(right) - releaseTimestamp(left) || right.addedAt - left.addedAt;
}

function releaseTimestamp(work: Work) {
  const exact = work.releaseStart ? Date.parse(`${work.releaseStart}T00:00:00Z`) : Number.NaN;
  return Number.isFinite(exact) ? exact : (work.year ?? 0) * 31_536_000_000;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function fuzzyScore(query: string, document: typeof searchDocuments.$inferSelect) {
  const primary = normalizeSearchText(document.primaryText);
  const haystack = normalizeSearchText(
    `${document.primaryText} ${document.secondaryText} ${document.keywords}`,
  );
  if (primary === query) return 1_000;
  if (primary.startsWith(query)) return 800 - primary.length;
  if (haystack.includes(query)) return 600 - haystack.indexOf(query);
  const queryTrigrams = trigrams(query);
  const textTrigrams = trigrams(haystack);
  const intersection = [...queryTrigrams].filter((part) => textTrigrams.has(part)).length;
  const union = new Set([...queryTrigrams, ...textTrigrams]).size;
  const similarity = union ? intersection / union : 0;
  return similarity >= 0.18 ? Math.round(similarity * 400) : 0;
}

function trigrams(value: string) {
  const compact = `  ${value.replaceAll(" ", "_")}  `;
  return new Set(
    Array.from({ length: Math.max(compact.length - 2, 0) }, (_, index) =>
      compact.slice(index, index + 3),
    ),
  );
}

function valueFrequency(catalog: Work[], values: (work: Work) => string[]) {
  const frequencies = new Map<string, number>();
  for (const work of catalog) {
    for (const value of new Set(values(work)))
      frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  }
  return frequencies;
}

function weightedJaccard(
  left: string[],
  right: string[],
  frequencies: Map<string, number>,
  total: number,
) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) return { score: 0, shared: [] as string[] };
  const weight = (value: string) => Math.log((total + 1) / ((frequencies.get(value) ?? 0) + 1)) + 1;
  const shared = [...leftSet].filter((value) => rightSet.has(value));
  const numerator = shared.reduce((sum, value) => sum + weight(value), 0);
  const denominator = [...union].reduce((sum, value) => sum + weight(value), 0);
  return { score: denominator ? numerator / denominator : 0, shared };
}

function simpleJaccard(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  const shared = [...leftSet].filter((value) => rightSet.has(value));
  return { score: union.size ? shared.length / union.size : 0, shared };
}

function recommendationFor(
  source: Work,
  candidate: Work,
  assignments: Map<string, string>,
  tagFrequency: Map<string, number>,
  genreFrequency: Map<string, number>,
  total: number,
): Recommendation {
  const reasons: RecommendationReason[] = [];
  let score = 0;
  const add = (signal: RecommendationReason["signal"], label: string, contribution: number) => {
    if (contribution <= 0.005) return;
    score += contribution;
    reasons.push({ signal, label, contribution });
  };
  const tags = weightedJaccard(source.tags, candidate.tags, tagFrequency, total);
  add("tag", tags.shared.slice(0, 2).join(" · "), tags.score * 0.24);
  const genres = weightedJaccard(source.genres, candidate.genres, genreFrequency, total);
  add("genre", genres.shared.slice(0, 2).join(" · "), genres.score * 0.16);
  const tones = simpleJaccard(source.tone, candidate.tone);
  add("tone", tones.shared.slice(0, 2).join(" · "), tones.score * 0.1);
  if (assignments.get(source.id) && assignments.get(source.id) === assignments.get(candidate.id)) {
    add("planet", "الكوكب نفسه", 0.14);
  }
  const sourcePeople = source.contributors.filter((item) => item.entityType === "person");
  const candidatePeople = new Set(
    candidate.contributors
      .filter((item) => item.entityType === "person")
      .map((item) => item.entityId),
  );
  const sharedPeople = sourcePeople.filter((item) => candidatePeople.has(item.entityId));
  add(
    "person",
    sharedPeople
      .slice(0, 2)
      .map((item) => item.name)
      .join(" · "),
    Math.min(sharedPeople.length / 2, 1) * 0.1,
  );
  const sharedStudios = source.animationStudios.filter((studio) =>
    candidate.animationStudios.some((item) => item.entityId === studio.entityId),
  );
  add(
    "studio",
    sharedStudios.map((studio) => studio.name).join(" · "),
    Math.min(sharedStudios.length, 1) * 0.06,
  );
  if (source.audience && source.audience === candidate.audience)
    add("audience", `فئة ${source.audience}`, 0.05);
  const countries = simpleJaccard(source.country, candidate.country);
  add("country", countries.shared.slice(0, 2).join(" · "), countries.score * 0.04);
  if (
    source.sourceMaterial?.type &&
    source.sourceMaterial.type === candidate.sourceMaterial?.type
  ) {
    add("source", `مصدر ${source.sourceMaterial.type}`, 0.04);
  }
  if (source.kind === candidate.kind) add("kind", "نوع العمل نفسه", 0.03);
  const sharedScores = Object.keys(source.scoreComponents).filter(
    (key) =>
      source.scoreComponents[key as keyof typeof source.scoreComponents] !== undefined &&
      candidate.scoreComponents[key as keyof typeof candidate.scoreComponents] !== undefined,
  );
  if (sharedScores.length) {
    const averageDistance =
      sharedScores.reduce((sum, key) => {
        const criterion = key as keyof typeof source.scoreComponents;
        return (
          sum +
          Math.abs(
            (source.scoreComponents[criterion] ?? 0) - (candidate.scoreComponents[criterion] ?? 0),
          )
        );
      }, 0) / sharedScores.length;
    add("score", "ملف تقييم متقارب", Math.max(0, 1 - averageDistance / 10) * 0.06);
  }
  const sourceRiskProfile = source.riskProfile;
  const candidateRiskProfile = candidate.riskProfile;
  if (sourceRiskProfile && candidateRiskProfile) {
    const levels = ["none", "low", "medium", "high", "unknown"];
    const distance = (["sexuality", "behavioral", "theology"] as const).reduce(
      (sum, key) =>
        sum +
        Math.abs(
          levels.indexOf(sourceRiskProfile[key]) - levels.indexOf(candidateRiskProfile[key]),
        ),
      0,
    );
    add("risk", "مستوى محتوى متقارب", Math.max(0, 1 - distance / 9) * 0.05);
  }
  if (source.year && candidate.year)
    add(
      "era",
      "حقبة إصدار متقاربة",
      Math.max(0, 1 - Math.abs(source.year - candidate.year) / 30) * 0.04,
    );
  const explicitRelation = source.relations.some((relation) => relation.workId === candidate.id);
  if (explicitRelation) add("relationship", "صلة مباشرة بين العملين", 0.12);
  return {
    work: candidate,
    score: Math.min(100, Math.round(score * 1000) / 10),
    reasons: reasons.sort((left, right) => right.contribution - left.contribution).slice(0, 5),
  };
}

function issue(
  severity: ValidationIssue["severity"],
  entityType: ValidationIssue["entityType"],
  entityId: string,
  title: string,
  path: string,
  message: string,
  action: string,
): ValidationIssue {
  return {
    id: `${entityType}:${entityId}:${path}:${message}`,
    severity,
    entityType,
    entityId,
    title,
    path,
    message,
    action,
  };
}
