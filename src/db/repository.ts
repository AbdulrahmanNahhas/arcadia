import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import type {
  AdminEntityInput,
  AdminWorkUpdate,
  CreateWork,
  EditableWorkStructure,
  Entity,
  RecordTrackingEntry,
  SavedUserView,
  TrackingEntry,
  TrackingPageInput,
  UpdateSavedUserView,
  Work,
  WorkContribution,
  WorkKind,
  WorkRelation,
  WorkStructure,
} from "@/features/library/model";
import {
  recordTrackingEntrySchema,
  savedViewColorSchema,
  savedViewIconSchema,
} from "@/features/library/model";
import {
  calculatedRating,
  type ScoreComponents,
  type ScoreCriterion,
  scoreCriteria,
} from "@/features/library/scoring";
import { db } from "./client";
import {
  assets,
  entities,
  entityAliases,
  entityExternalIdentities,
  externalLinks,
  personalScores,
  personalState,
  savedViews,
  searchDocuments,
  terms,
  trackingEntries,
  workContributors,
  workPlanetAssignments,
  workRelations,
  workRiskAssessments,
  workSeasons,
  works,
  workTerms,
  workTitles,
  workUnits,
} from "./schema";

type WorkDetails = Partial<
  Pick<
    Work,
    | "palette"
    | "sharedWith"
    | "contentWarnings"
    | "analysisNotes"
    | "riskProfile"
    | "releaseStart"
    | "releaseEnd"
    | "watchDates"
    | "country"
    | "sourceMaterial"
    | "publication"
    | "curation"
  >
>;

const forbiddenDetailKeys = [
  "aliases",
  "creator",
  "externalLinks",
  "favoriteCharacters",
  "genres",
  "studios",
  "tags",
  "tone",
] as const;

function normalizedDetails(details: Record<string, unknown> | null | undefined): WorkDetails {
  const next = { ...(details ?? {}) };
  for (const key of forbiddenDetailKeys) delete next[key];
  if (next.publication && typeof next.publication === "object") {
    const publication = { ...next.publication } as Record<string, unknown>;
    delete publication.demographic;
    next.publication = publication;
  }
  return next;
}

function upsertSearchDocument(input: typeof searchDocuments.$inferInsert) {
  db.insert(searchDocuments)
    .values(input)
    .onConflictDoUpdate({
      target: searchDocuments.id,
      set: {
        entityType: input.entityType,
        entityId: input.entityId,
        primaryText: input.primaryText,
        secondaryText: input.secondaryText ?? "",
        keywords: input.keywords ?? "",
        imagePath: input.imagePath ?? null,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    })
    .run();
}

function slug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mimeTypeForPath(path: string) {
  const extension = path.split(".").pop()?.toLocaleLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}

function deriveProgressMetric(
  work: typeof works.$inferSelect,
  structure?: { count: number; unitType: string },
) {
  if (structure && structure.count > 0 && ["episode", "chapter"].includes(structure.unitType)) {
    return {
      total: structure.count,
      unit: `${structure.unitType}${structure.unitType.endsWith("s") ? "" : "s"}`,
    };
  }
  const candidates: Array<[number | null, string]> =
    work.kind === "movie"
      ? [[null, "movie"]]
      : work.kind === "series" || work.kind === "anime"
        ? [[work.episodeCount, "episodes"]]
        : work.kind === "manga" || work.kind === "comic" || work.kind === "novel"
          ? [[work.chapterCount, "chapters"]]
          : [[null, "work"]];
  const known = candidates.find(([total]) => total !== null);
  return known
    ? { total: known[0], unit: known[1] }
    : { total: null, unit: candidates[0]?.[1] ?? "work" };
}

export function listWorks(): Work[] {
  const rows = db
    .select({ work: works, personal: personalState })
    .from(works)
    .leftJoin(personalState, eq(personalState.workId, works.id))
    .orderBy(asc(works.sortTitle))
    .all();

  const workIds = rows.map(({ work }) => work.id);
  if (workIds.length === 0) return [];

  const structuralUnits = db
    .select({ workId: workUnits.workId, unitType: workUnits.unitType })
    .from(workUnits)
    .where(inArray(workUnits.workId, workIds))
    .all();
  const structureByWork = new Map<string, { count: number; unitType: string }>();
  for (const unit of structuralUnits) {
    const current = structureByWork.get(unit.workId);
    structureByWork.set(unit.workId, {
      count: (current?.count ?? 0) + 1,
      unitType: current?.unitType ?? unit.unitType,
    });
  }

  const workAssets = db.select().from(assets).where(inArray(assets.ownerId, workIds)).all();
  const assetsByWork = new Map<string, Map<string, string>>();
  for (const asset of workAssets) {
    if (asset.ownerType !== "work") continue;
    const byType = assetsByWork.get(asset.ownerId) ?? new Map<string, string>();
    if (!byType.has(asset.assetType)) {
      byType.set(asset.assetType, asset.relativePath);
    }
    assetsByWork.set(asset.ownerId, byType);
  }

  const titleRows = db.select().from(workTitles).where(inArray(workTitles.workId, workIds)).all();
  const aliasesByWork = new Map<string, string[]>();
  const arabicTitleByWork = new Map<string, string>();
  for (const title of titleRows) {
    if (title.titleType === "canonical") continue;
    if (title.titleType === "localized" && title.language === "ar") {
      if (title.isPreferred || !arabicTitleByWork.has(title.workId)) {
        arabicTitleByWork.set(title.workId, title.title);
      }
      continue;
    }
    const values = aliasesByWork.get(title.workId) ?? [];
    if (!values.includes(title.title)) values.push(title.title);
    aliasesByWork.set(title.workId, values);
  }

  const termRows = db
    .select({ workId: workTerms.workId, term: terms })
    .from(workTerms)
    .innerJoin(terms, eq(workTerms.termId, terms.id))
    .where(inArray(workTerms.workId, workIds))
    .all();
  const termsByWork = new Map<string, Map<string, string[]>>();
  for (const { workId, term } of termRows) {
    const byVocabulary = termsByWork.get(workId) ?? new Map<string, string[]>();
    const values = byVocabulary.get(term.vocabulary) ?? [];
    if (!values.includes(term.name)) values.push(term.name);
    byVocabulary.set(term.vocabulary, values);
    termsByWork.set(workId, byVocabulary);
  }

  const scoreRows = db
    .select()
    .from(personalScores)
    .where(inArray(personalScores.workId, workIds))
    .all();
  const scoresByWork = new Map<string, ScoreComponents>();
  for (const row of scoreRows) {
    const components = scoresByWork.get(row.workId) ?? {};
    components[row.criterion as ScoreCriterion] = row.value;
    scoresByWork.set(row.workId, components);
  }

  const linkRows = db
    .select()
    .from(externalLinks)
    .where(and(eq(externalLinks.ownerType, "work"), inArray(externalLinks.ownerId, workIds)))
    .all();
  const linksByWork = new Map<string, Work["externalLinks"]>();
  for (const link of linkRows) {
    const values = linksByWork.get(link.ownerId) ?? [];
    values.push({
      provider: link.provider,
      label: link.label || link.provider,
      url: link.url,
    });
    linksByWork.set(link.ownerId, values);
  }

  const contributionRows = db
    .select({ contribution: workContributors, entity: entities })
    .from(workContributors)
    .innerJoin(entities, eq(workContributors.entityId, entities.id))
    .where(inArray(workContributors.workId, workIds))
    .orderBy(asc(workContributors.position))
    .all();
  const contributorsByWork = new Map<string, WorkContribution[]>();
  for (const { contribution, entity } of contributionRows) {
    const values = contributorsByWork.get(contribution.workId) ?? [];
    values.push({
      entityId: entity.id,
      name: entity.name,
      entityType: entity.entityType as WorkContribution["entityType"],
      role: contribution.role as WorkContribution["role"],
      isPrimary: contribution.isPrimary,
    });
    contributorsByWork.set(contribution.workId, values);
  }

  const relationRows = db
    .select()
    .from(workRelations)
    .where(
      or(
        inArray(workRelations.sourceWorkId, workIds),
        inArray(workRelations.targetWorkId, workIds),
      ),
    )
    .all();
  const latestTrackingByWork = new Map<string, string>();
  for (const entry of db
    .select({
      workId: trackingEntries.workId,
      occurredOn: trackingEntries.occurredOn,
    })
    .from(trackingEntries)
    .where(inArray(trackingEntries.workId, workIds))
    .orderBy(desc(trackingEntries.occurredOn), desc(trackingEntries.daySequence))
    .all()) {
    if (!latestTrackingByWork.has(entry.workId)) {
      latestTrackingByWork.set(entry.workId, entry.occurredOn);
    }
  }

  const workRowsById = new Map(rows.map(({ work }) => [work.id, work]));
  const relationsByWork = new Map<string, WorkRelation[]>();
  for (const relation of relationRows) {
    const source = workRowsById.get(relation.sourceWorkId);
    const target = workRowsById.get(relation.targetWorkId);
    if (!source || !target) continue;
    const append = (
      workId: string,
      related: typeof works.$inferSelect,
      direction: WorkRelation["direction"],
    ) => {
      const relations = relationsByWork.get(workId) ?? [];
      const media = assetsByWork.get(related.id);
      relations.push({
        id: relation.id,
        workId: related.id,
        relationType: relation.relationType as WorkRelation["relationType"],
        direction,
        notes: relation.notes,
        provenance: relation.provenance,
        externalKey: relation.externalKey,
        work: {
          id: related.id,
          title: related.canonicalTitle,
          kind: related.kind as WorkKind,
          year: related.releaseYear,
          releaseStatus: related.status as Work["releaseStatus"],
          imagePath: media?.get("poster") ?? null,
        },
      });
      relationsByWork.set(workId, relations);
    };
    append(source.id, target, "outgoing");
    append(target.id, source, "incoming");
  }

  return rows.map(({ work, personal }) => {
    const details = normalizedDetails(work.metadata);
    const metric = deriveProgressMetric(work, structureByWork.get(work.id));
    const media = assetsByWork.get(work.id);
    const taxonomy = termsByWork.get(work.id);
    const contributors = contributorsByWork.get(work.id) ?? [];
    const primaryCreators = contributors.filter(({ role }) =>
      ["author", "creator", "director"].includes(role),
    );
    const animationStudios = contributors.filter(({ role }) => role === "animation-studio");
    const productionCompanies = contributors.filter(({ role }) => role === "production-company");
    const publishers = contributors.filter(({ role }) => role === "publisher");
    const studios = animationStudios.map(({ name }) => name);
    const creatorNames = primaryCreators.map(({ name }) => name);
    const scoreComponents = scoresByWork.get(work.id) ?? {};

    return {
      id: work.id,
      title: work.canonicalTitle,
      arabicTitle: arabicTitleByWork.get(work.id) ?? null,
      kind: work.kind as WorkKind,
      year: work.releaseYear,
      releaseStatus: work.status as Work["releaseStatus"],
      runtimeMinutes: work.runtimeMinutes,
      playtimeMinutes: work.playtimeMinutes,
      pageCount: work.pageCount,
      episodeCount: work.episodeCount,
      chapterCount: work.chapterCount,
      volumeCount: work.volumeCount,
      routeCount: work.routeCount,
      status: (personal?.status ?? "saved") as Work["status"],
      progress: personal?.progress ?? 0,
      progressTotal: metric.total,
      progressUnit: metric.unit,
      calculatedRating: calculatedRating(scoreComponents),
      favorite: personal?.favorite ?? false,
      completedAt: personal?.completedAt ?? null,
      trackedOn: latestTrackingByWork.get(work.id) ?? null,
      summary: work.summary,
      tags: taxonomy?.get("tag") ?? [],
      genres: taxonomy?.get("genre") ?? [],
      aliases: aliasesByWork.get(work.id) ?? [],
      studios,
      audience: (taxonomy?.get("audience")?.[0] ?? null) as Work["audience"],
      sharedWith: details.sharedWith ?? [],
      tone: taxonomy?.get("tone") ?? [],
      contentWarnings: details.contentWarnings ?? null,
      analysisNotes: details.analysisNotes ?? null,
      riskProfile: details.riskProfile ?? null,
      scoreComponents,
      externalLinks: linksByWork.get(work.id) ?? [],
      releaseStart: details.releaseStart ?? null,
      releaseEnd: details.releaseEnd ?? null,
      watchDates: details.watchDates ?? null,
      country: (taxonomy?.get("country") ?? details.country ?? []) as Work["country"],
      sourceMaterial: details.sourceMaterial ?? null,
      publication: details.publication ?? null,
      curation: details.curation ?? null,
      contributors,
      animationStudios,
      productionCompanies,
      publishers,
      relations: relationsByWork.get(work.id) ?? [],
      isSequelMovie:
        work.kind === "movie" &&
        relationRows.some(
          (relation) => relation.relationType === "sequel" && relation.targetWorkId === work.id,
        ),
      creator: creatorNames.join(" · ") || studios.join(" · ") || "Unknown creator",
      imagePath: media?.get("poster") ?? null,
      bannerPath: media?.get("banner") ?? null,
      logoPath: media?.get("logo") ?? null,
      palette: details.palette ?? "new",
      addedAt: work.createdAt,
      catalogUpdatedAt: work.updatedAt,
      personalUpdatedAt: personal?.updatedAt ?? work.updatedAt,
    };
  });
}

export function listEntities(): Entity[] {
  const catalog = listWorks();
  const worksById = new Map(catalog.map((work) => [work.id, work]));
  const imageByEntity = new Map(
    db
      .select()
      .from(assets)
      .where(and(eq(assets.ownerType, "entity"), eq(assets.assetType, "profile")))
      .all()
      .map((asset) => [asset.ownerId, asset.relativePath]),
  );
  const contributionsByEntity = new Map<string, Array<typeof workContributors.$inferSelect>>();
  const aliasesByEntity = new Map<string, string[]>();
  for (const alias of db.select().from(entityAliases).all()) {
    const values = aliasesByEntity.get(alias.entityId) ?? [];
    values.push(alias.alias);
    aliasesByEntity.set(alias.entityId, values);
  }
  const identitiesByEntity = new Map<string, Entity["externalIdentities"]>();
  for (const identity of db.select().from(entityExternalIdentities).all()) {
    const values = identitiesByEntity.get(identity.entityId) ?? [];
    values.push({
      provider: identity.provider,
      externalId: identity.externalId,
      url: identity.url,
    });
    identitiesByEntity.set(identity.entityId, values);
  }

  for (const contribution of db
    .select()
    .from(workContributors)
    .orderBy(asc(workContributors.position))
    .all()) {
    const values = contributionsByEntity.get(contribution.entityId) ?? [];
    values.push(contribution);
    contributionsByEntity.set(contribution.entityId, values);
  }

  return db
    .select()
    .from(entities)
    .orderBy(asc(entities.sortName))
    .all()
    .map((entity) => {
      const metadata = entity.metadata as {
        malId?: unknown;
        sourceUrl?: unknown;
        sourceProvider?: unknown;
        establishedAt?: unknown;
        favorites?: unknown;
        alternativeNames?: unknown;
      };
      const contributions = contributionsByEntity.get(entity.id) ?? [];
      const roles = new Map<Entity["roles"][number]["role"], number>();
      const kinds = new Map<WorkKind, number>();
      const linkedWorks = new Map<string, Entity["works"][number]>();

      for (const contribution of contributions) {
        const work = worksById.get(contribution.workId);
        if (!work) continue;
        const role = contribution.role as Entity["roles"][number]["role"];
        roles.set(role, (roles.get(role) ?? 0) + 1);
        if (!linkedWorks.has(work.id)) {
          kinds.set(work.kind, (kinds.get(work.kind) ?? 0) + 1);
          linkedWorks.set(work.id, {
            id: work.id,
            title: work.title,
            arabicTitle: work.arabicTitle,
            kind: work.kind,
            year: work.year,
            status: work.status,
            releaseStatus: work.releaseStatus,
            calculatedRating: work.calculatedRating,
            isSequelMovie: work.isSequelMovie,
            imagePath: work.imagePath,
            roles: [role],
          });
        } else {
          const linked = linkedWorks.get(work.id);
          if (linked && !linked.roles.includes(role)) linked.roles.push(role);
        }
      }

      return {
        id: entity.id,
        name: entity.name,
        sortName: entity.sortName,
        entityType: entity.entityType as Entity["entityType"],
        description: entity.description,
        imagePath: imageByEntity.get(entity.id) ?? null,
        malId: typeof metadata.malId === "number" ? metadata.malId : null,
        sourceUrl: typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : null,
        sourceProvider:
          typeof metadata.sourceProvider === "string"
            ? metadata.sourceProvider
            : typeof metadata.malId === "number"
              ? "MyAnimeList"
              : null,
        establishedAt: typeof metadata.establishedAt === "string" ? metadata.establishedAt : null,
        favorites: typeof metadata.favorites === "number" ? metadata.favorites : null,
        alternativeNames: [
          ...new Set([
            ...(aliasesByEntity.get(entity.id) ?? []),
            ...(Array.isArray(metadata.alternativeNames)
              ? metadata.alternativeNames.filter(
                  (name): name is string => typeof name === "string" && Boolean(name.trim()),
                )
              : []),
          ]),
        ],
        externalIdentities: identitiesByEntity.get(entity.id) ?? [],
        workCount: linkedWorks.size,
        roles: [...roles.entries()]
          .map(([role, count]) => ({ role, count }))
          .sort((left, right) => right.count - left.count),
        kinds: [...kinds.entries()]
          .map(([kind, count]) => ({ kind, count }))
          .sort((left, right) => right.count - left.count),
        works: [...linkedWorks.values()].sort(
          (left, right) =>
            (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title, "en"),
        ),
      };
    });
}

export function saveEntity(input: AdminEntityInput): Entity {
  const id = input.id ?? crypto.randomUUID();
  const existing = db.select().from(entities).where(eq(entities.id, id)).get();
  if (input.id && !existing) throw new Error("Entity not found");

  if (input.entityType === "person") {
    const invalidRole = db
      .select({ role: workContributors.role })
      .from(workContributors)
      .where(eq(workContributors.entityId, id))
      .all()
      .find(({ role }) =>
        ["animation-studio", "production-company", "developer", "publisher"].includes(role),
      );
    if (invalidRole) throw new Error(`The ${invalidRole.role} role requires an organization.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const metadata: Record<string, unknown> = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    malId: input.malId,
    sourceUrl: input.sourceUrl,
    sourceProvider: input.sourceProvider,
    establishedAt: input.establishedAt,
    favorites: input.favorites,
  };
  delete metadata.alternativeNames;

  db.transaction((tx) => {
    tx.insert(entities)
      .values({
        id,
        name: input.name,
        sortName: input.sortName,
        entityType: input.entityType,
        description: input.description,
        metadata,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: entities.id,
        set: {
          name: input.name,
          sortName: input.sortName,
          entityType: input.entityType,
          description: input.description,
          metadata,
          updatedAt: now,
        },
      })
      .run();

    tx.delete(entityAliases).where(eq(entityAliases.entityId, id)).run();
    const aliases = new Map(
      input.alternativeNames.map((alias) => [alias.trim().toLocaleLowerCase(), alias.trim()]),
    );
    for (const [normalizedAlias, alias] of aliases) {
      if (!alias || normalizedAlias === input.name.toLocaleLowerCase()) continue;
      tx.insert(entityAliases)
        .values({ id: crypto.randomUUID(), entityId: id, alias, normalizedAlias })
        .run();
    }

    tx.delete(entityExternalIdentities).where(eq(entityExternalIdentities.entityId, id)).run();
    const identities = new Map(
      input.externalIdentities.map((identity) => [
        `${identity.provider.toLocaleLowerCase()}:${identity.externalId.toLocaleLowerCase()}`,
        identity,
      ]),
    );
    for (const identity of identities.values()) {
      tx.insert(entityExternalIdentities)
        .values({ id: crypto.randomUUID(), entityId: id, ...identity })
        .run();
    }

    const profile = tx
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.ownerType, "entity"),
          eq(assets.ownerId, id),
          eq(assets.assetType, "profile"),
        ),
      )
      .get();
    if (input.imagePath && profile) {
      tx.update(assets)
        .set({ relativePath: input.imagePath, mimeType: mimeTypeForPath(input.imagePath) })
        .where(eq(assets.id, profile.id))
        .run();
    } else if (input.imagePath) {
      tx.insert(assets)
        .values({
          id: crypto.randomUUID(),
          ownerType: "entity",
          ownerId: id,
          assetType: "profile",
          relativePath: input.imagePath,
          mimeType: mimeTypeForPath(input.imagePath),
        })
        .run();
    } else if (profile) {
      tx.delete(assets).where(eq(assets.id, profile.id)).run();
    }
  });

  upsertSearchDocument({
    id: `${input.entityType === "person" ? "person" : "studio"}:${id}`,
    entityType: input.entityType === "person" ? "person" : "studio",
    entityId: id,
    primaryText: input.name,
    secondaryText: input.alternativeNames.join(" "),
    keywords: input.description,
    imagePath: input.imagePath,
  });

  const saved = listEntities().find((entity) => entity.id === id);
  if (!saved) throw new Error("Could not reload entity");
  return saved;
}

export function deleteEntities(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  db.transaction((tx) => {
    tx.delete(searchDocuments)
      .where(
        inArray(
          searchDocuments.id,
          uniqueIds.flatMap((id) => [`person:${id}`, `studio:${id}`]),
        ),
      )
      .run();
    tx.delete(assets)
      .where(and(eq(assets.ownerType, "entity"), inArray(assets.ownerId, uniqueIds)))
      .run();
    tx.delete(entities).where(inArray(entities.id, uniqueIds)).run();
  });
  return { deleted: uniqueIds.length };
}

export function createWork(input: CreateWork): Work {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  db.transaction((tx) => {
    tx.insert(works)
      .values({
        id,
        kind: input.kind,
        canonicalTitle: input.title,
        sortTitle: input.title.toLocaleLowerCase(),
        summary: input.summary,
        releaseYear: input.year,
        status: "released",
        metadata: { palette: "new" },
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.insert(workTitles)
      .values({
        id: crypto.randomUUID(),
        workId: id,
        title: input.title,
        titleType: "canonical",
        isPreferred: true,
      })
      .run();
    tx.insert(personalState)
      .values({ workId: id, status: input.status ?? "saved", updatedAt: now })
      .run();
    if (["movie", "series", "anime"].includes(input.kind)) {
      tx.insert(workPlanetAssignments)
        .values({
          workId: id,
          planetId: "planet-adventure",
          source: "migration-default",
          reviewState: "needs-review",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });

  upsertSearchDocument({
    id: `work:${id}`,
    entityType: "work",
    entityId: id,
    primaryText: input.title,
    secondaryText: "",
    keywords: `${input.kind} ${input.summary}`,
  });

  const created = listWorks().find((work) => work.id === id);
  if (!created) throw new Error("Could not create work");
  return created;
}

export function updateFavorite(workId: string, favorite: boolean) {
  db.update(personalState)
    .set({ favorite, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(personalState.workId, workId))
    .run();
  return { workId, favorite };
}

export type TaxonomyTermRecord = {
  id: string;
  vocabulary: string;
  key: string;
  labelEn: string;
  labelAr: string | null;
  description: string;
  descriptionAr: string;
  usageCount: number;
};

export function listTaxonomyTerms(): TaxonomyTermRecord[] {
  const usage = new Map<string, number>();
  for (const link of db.select({ termId: workTerms.termId }).from(workTerms).all()) {
    usage.set(link.termId, (usage.get(link.termId) ?? 0) + 1);
  }
  return db
    .select()
    .from(terms)
    .orderBy(asc(terms.vocabulary), asc(terms.name))
    .all()
    .map((term) => ({
      id: term.id,
      vocabulary: term.vocabulary,
      key: term.slug,
      labelEn: term.name,
      labelAr: term.labelAr,
      description: term.description,
      descriptionAr: term.descriptionAr,
      usageCount: usage.get(term.id) ?? 0,
    }));
}

export function updateTaxonomyTranslation(input: {
  id: string;
  labelAr: string | null;
  description: string;
  descriptionAr: string;
}) {
  const existing = db.select().from(terms).where(eq(terms.id, input.id)).get();
  if (!existing) throw new Error("Taxonomy term not found");
  db.update(terms)
    .set({
      labelAr: input.labelAr?.trim() || null,
      description: input.description.trim(),
      descriptionAr: input.descriptionAr.trim(),
    })
    .where(eq(terms.id, input.id))
    .run();
  const updated = listTaxonomyTerms().find((term) => term.id === input.id);
  if (!updated) throw new Error("Could not reload taxonomy term");
  return updated;
}

export function updateTaxonomyTranslations(
  inputs: Array<{
    id: string;
    labelAr: string | null;
    description: string;
    descriptionAr: string;
  }>,
) {
  db.transaction((tx) => {
    const existingIds = new Set(
      tx
        .select({ id: terms.id })
        .from(terms)
        .where(
          inArray(
            terms.id,
            inputs.map(({ id }) => id),
          ),
        )
        .all()
        .map(({ id }) => id),
    );
    const missing = inputs.find(({ id }) => !existingIds.has(id));
    if (missing) throw new Error(`Taxonomy term not found: ${missing.id}`);
    for (const input of inputs) {
      tx.update(terms)
        .set({
          labelAr: input.labelAr?.trim() || null,
          description: input.description.trim(),
          descriptionAr: input.descriptionAr.trim(),
        })
        .where(eq(terms.id, input.id))
        .run();
    }
  });
  return { updated: inputs.length };
}

export function updateWork(input: AdminWorkUpdate): Work {
  const existing = db
    .select({ work: works, personal: personalState })
    .from(works)
    .leftJoin(personalState, eq(personalState.workId, works.id))
    .where(eq(works.id, input.id))
    .get();
  if (!existing) throw new Error("Work not found");

  const now = Math.floor(Date.now() / 1000);
  const details: WorkDetails = {
    ...normalizedDetails(existing.work.metadata),
    palette: normalizedDetails(existing.work.metadata).palette,
    sharedWith: input.sharedWith,
    contentWarnings: input.contentWarnings,
    analysisNotes: input.analysisNotes,
    riskProfile: input.riskProfile,
    releaseStart: input.releaseStart,
    releaseEnd: input.releaseEnd,
    watchDates: input.watchDates,
    country: undefined,
    sourceMaterial: input.sourceMaterial,
    publication: input.publication,
    curation: input.curation,
  };

  db.transaction((tx) => {
    tx.update(works)
      .set({
        kind: input.kind,
        canonicalTitle: input.title,
        sortTitle: input.title.toLocaleLowerCase(),
        summary: input.summary,
        releaseYear: input.year,
        status: input.releaseStatus,
        runtimeMinutes: input.runtimeMinutes,
        playtimeMinutes: input.playtimeMinutes,
        pageCount: input.pageCount,
        episodeCount: input.episodeCount,
        chapterCount: input.chapterCount,
        volumeCount: input.volumeCount,
        routeCount: input.routeCount,
        metadata: details,
        updatedAt: now,
      })
      .where(eq(works.id, input.id))
      .run();

    tx.delete(workRiskAssessments).where(eq(workRiskAssessments.workId, input.id)).run();
    if (input.riskProfile) {
      const riskValues = [
        ["risk-sexuality", input.riskProfile.sexuality],
        ["risk-behavioral", input.riskProfile.behavioral],
        ["risk-theology", input.riskProfile.theology],
      ] as const;
      for (const [dimensionId, level] of riskValues) {
        if (level === "unknown") continue;
        tx.insert(workRiskAssessments).values({ workId: input.id, dimensionId, level }).run();
      }
    }

    if (["movie", "series", "anime"].includes(input.kind)) {
      tx.insert(workPlanetAssignments)
        .values({
          workId: input.id,
          planetId: "planet-adventure",
          source: "migration-default",
          reviewState: "needs-review",
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
    } else {
      tx.delete(workPlanetAssignments).where(eq(workPlanetAssignments.workId, input.id)).run();
    }

    tx.delete(workTitles)
      .where(and(eq(workTitles.workId, input.id), eq(workTitles.titleType, "alias")))
      .run();
    const canonical = tx
      .select()
      .from(workTitles)
      .where(and(eq(workTitles.workId, input.id), eq(workTitles.titleType, "canonical")))
      .get();
    if (canonical) {
      tx.update(workTitles)
        .set({ title: input.title, isPreferred: true })
        .where(eq(workTitles.id, canonical.id))
        .run();
    } else {
      tx.insert(workTitles)
        .values({
          id: crypto.randomUUID(),
          workId: input.id,
          title: input.title,
          titleType: "canonical",
          isPreferred: true,
        })
        .run();
    }
    const arabicTitle = input.arabicTitle?.trim() || null;
    const existingArabicTitle = tx
      .select()
      .from(workTitles)
      .where(
        and(
          eq(workTitles.workId, input.id),
          eq(workTitles.titleType, "localized"),
          eq(workTitles.language, "ar"),
        ),
      )
      .get();
    if (arabicTitle && existingArabicTitle) {
      tx.update(workTitles)
        .set({
          title: arabicTitle,
          script: "Arab",
          isPreferred: true,
        })
        .where(eq(workTitles.id, existingArabicTitle.id))
        .run();
    } else if (arabicTitle) {
      tx.insert(workTitles)
        .values({
          id: crypto.randomUUID(),
          workId: input.id,
          title: arabicTitle,
          titleType: "localized",
          language: "ar",
          script: "Arab",
          isPreferred: true,
        })
        .run();
    } else if (existingArabicTitle) {
      tx.delete(workTitles).where(eq(workTitles.id, existingArabicTitle.id)).run();
    }
    for (const alias of [...new Set(input.aliases.map((item) => item.trim()))]) {
      if (!alias || alias === input.title) continue;
      tx.insert(workTitles)
        .values({
          id: crypto.randomUUID(),
          workId: input.id,
          title: alias,
          titleType: "alias",
        })
        .run();
    }

    const vocabularies = {
      genre: input.genres,
      tone: input.tone,
      tag: input.tags,
      audience: input.audience ? [input.audience] : [],
      country: input.country,
    };
    const oldTerms = tx
      .select({ id: terms.id })
      .from(terms)
      .where(inArray(terms.vocabulary, Object.keys(vocabularies)))
      .all();
    if (oldTerms.length) {
      tx.delete(workTerms)
        .where(
          and(
            eq(workTerms.workId, input.id),
            inArray(
              workTerms.termId,
              oldTerms.map(({ id }) => id),
            ),
          ),
        )
        .run();
    }
    for (const [vocabulary, values] of Object.entries(vocabularies)) {
      for (const name of [...new Set(values.map((item) => item.trim()))]) {
        if (!name) continue;
        const termSlug = slug(name);
        let term = tx
          .select()
          .from(terms)
          .where(and(eq(terms.vocabulary, vocabulary), eq(terms.slug, termSlug)))
          .get();
        if (!term && vocabulary === "country") {
          const id = crypto.randomUUID();
          tx.insert(terms).values({ id, vocabulary, name, slug: termSlug }).run();
          term = tx.select().from(terms).where(eq(terms.id, id)).get();
        }
        if (!term) {
          throw new Error(
            `Unknown controlled ${vocabulary} term: ${name}. Add it to the taxonomy registry first.`,
          );
        }
        if (term) {
          tx.insert(workTerms)
            .values({ workId: input.id, termId: term.id })
            .onConflictDoNothing()
            .run();
        }
      }
    }

    tx.delete(externalLinks)
      .where(and(eq(externalLinks.ownerType, "work"), eq(externalLinks.ownerId, input.id)))
      .run();
    for (const link of input.externalLinks) {
      tx.insert(externalLinks)
        .values({
          id: crypto.randomUUID(),
          ownerType: "work",
          ownerId: input.id,
          provider: link.provider,
          label: link.label,
          url: link.url,
        })
        .run();
    }

    tx.delete(workContributors).where(eq(workContributors.workId, input.id)).run();
    for (const [position, contribution] of input.contributors.entries()) {
      const sortName = contribution.name.trim().toLocaleLowerCase();
      const entityType = contribution.entityType;
      const organizationOnlyRoles = [
        "animation-studio",
        "production-company",
        "developer",
        "publisher",
      ];
      if (organizationOnlyRoles.includes(contribution.role) && entityType !== "organization") {
        throw new Error(`${contribution.role} credits require an organization.`);
      }
      let entity = contribution.entityId.startsWith("new:")
        ? undefined
        : tx.select().from(entities).where(eq(entities.id, contribution.entityId)).get();
      if (entity && entity.entityType !== entityType) {
        throw new Error(`Contributor type does not match entity ${entity.name}.`);
      }
      entity ??= tx
        .select()
        .from(entities)
        .where(and(eq(entities.entityType, entityType), eq(entities.sortName, sortName)))
        .get();
      if (!entity) {
        const id = crypto.randomUUID();
        tx.insert(entities)
          .values({
            id,
            entityType,
            name: contribution.name.trim(),
            sortName,
          })
          .run();
        entity = tx.select().from(entities).where(eq(entities.id, id)).get();
      }
      if (entity) {
        tx.insert(workContributors)
          .values({
            workId: input.id,
            entityId: entity.id,
            role: contribution.role,
            isPrimary: contribution.isPrimary,
            position,
          })
          .onConflictDoNothing()
          .run();
      }
    }

    const publicationPublisher = input.publication?.publisher?.trim();
    if (
      publicationPublisher &&
      !input.contributors.some(
        ({ name, role }) =>
          role === "publisher" &&
          name.trim().localeCompare(publicationPublisher, undefined, {
            sensitivity: "accent",
          }) === 0,
      )
    ) {
      const sortName = publicationPublisher.toLocaleLowerCase("en");
      let publisher = tx
        .select()
        .from(entities)
        .where(and(eq(entities.entityType, "organization"), eq(entities.sortName, sortName)))
        .get();
      if (!publisher) {
        const id = crypto.randomUUID();
        tx.insert(entities)
          .values({
            id,
            entityType: "organization",
            name: publicationPublisher,
            sortName,
          })
          .run();
        publisher = tx.select().from(entities).where(eq(entities.id, id)).get();
      }
      if (publisher) {
        tx.insert(workContributors)
          .values({
            workId: input.id,
            entityId: publisher.id,
            role: "publisher",
            isPrimary: false,
            position: input.contributors.length,
          })
          .onConflictDoNothing()
          .run();
      }
    }

    const existingRelations = tx
      .select()
      .from(workRelations)
      .where(or(eq(workRelations.sourceWorkId, input.id), eq(workRelations.targetWorkId, input.id)))
      .all();
    const existingById = new Map(existingRelations.map((relation) => [relation.id, relation]));
    const existingByKey = new Map(
      existingRelations.map((relation) => [
        `${relation.sourceWorkId}:${relation.targetWorkId}:${relation.relationType}`,
        relation,
      ]),
    );
    const desiredRelations = new Map<
      string,
      {
        id: string;
        sourceWorkId: string;
        targetWorkId: string;
        relationType: (typeof input.relations)[number]["relationType"];
        isDirected: boolean;
        notes: string;
        provenance: string;
        externalKey: string | null;
      }
    >();
    for (const relation of input.relations) {
      if (relation.workId === input.id) continue;
      let sourceWorkId = relation.direction === "outgoing" ? input.id : relation.workId;
      let targetWorkId = relation.direction === "outgoing" ? relation.workId : input.id;
      const isDirected = !["alternative", "related"].includes(relation.relationType);
      if (!isDirected && sourceWorkId > targetWorkId) {
        [sourceWorkId, targetWorkId] = [targetWorkId, sourceWorkId];
      }
      const key = `${sourceWorkId}:${targetWorkId}:${relation.relationType}`;
      const stable =
        (relation.id ? existingById.get(relation.id) : undefined) ?? existingByKey.get(key);
      desiredRelations.set(key, {
        id: stable?.id ?? crypto.randomUUID(),
        sourceWorkId,
        targetWorkId,
        relationType: relation.relationType,
        isDirected,
        notes: relation.notes,
        provenance: relation.provenance,
        externalKey: relation.externalKey,
      });
    }
    const desiredIds = new Set([...desiredRelations.values()].map(({ id }) => id));
    for (const relation of existingRelations) {
      if (!desiredIds.has(relation.id)) {
        tx.delete(workRelations).where(eq(workRelations.id, relation.id)).run();
      }
    }
    for (const relation of desiredRelations.values()) {
      tx.insert(workRelations)
        .values(relation)
        .onConflictDoUpdate({
          target: workRelations.id,
          set: {
            sourceWorkId: relation.sourceWorkId,
            targetWorkId: relation.targetWorkId,
            relationType: relation.relationType,
            isDirected: relation.isDirected,
            notes: relation.notes,
            provenance: relation.provenance,
            externalKey: relation.externalKey,
          },
        })
        .run();
    }

    const paths = {
      poster: input.imagePath,
      banner: input.bannerPath,
      logo: input.logoPath,
    };
    for (const [assetType, relativePath] of Object.entries(paths)) {
      const current = tx
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.ownerType, "work"),
            eq(assets.ownerId, input.id),
            eq(assets.assetType, assetType),
          ),
        )
        .get();
      if (relativePath && current) {
        tx.update(assets)
          .set({ relativePath, mimeType: mimeTypeForPath(relativePath) })
          .where(eq(assets.id, current.id))
          .run();
      } else if (relativePath) {
        tx.insert(assets)
          .values({
            id: crypto.randomUUID(),
            ownerType: "work",
            ownerId: input.id,
            assetType,
            relativePath,
            mimeType: mimeTypeForPath(relativePath),
          })
          .run();
      } else if (current) {
        tx.delete(assets).where(eq(assets.id, current.id)).run();
      }
    }

    tx.insert(personalState)
      .values({
        workId: input.id,
        favorite: input.favorite,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: personalState.workId,
        set: {
          favorite: input.favorite,
          updatedAt: now,
        },
      })
      .run();

    tx.delete(personalScores).where(eq(personalScores.workId, input.id)).run();
    for (const criterion of scoreCriteria) {
      const value = input.scoreComponents[criterion];
      if (value === undefined) continue;
      tx.insert(personalScores)
        .values({ workId: input.id, criterion, value, updatedAt: now })
        .run();
    }
  });

  upsertSearchDocument({
    id: `work:${input.id}`,
    entityType: "work",
    entityId: input.id,
    primaryText: input.title,
    secondaryText: [input.arabicTitle, ...input.aliases].filter(Boolean).join(" "),
    keywords: `${input.kind} ${input.summary}`,
    imagePath: input.imagePath,
  });

  const updated = listWorks().find((work) => work.id === input.id);
  if (!updated) throw new Error("Could not reload updated work");
  return updated;
}

export function createWorksBulk(
  inputs: Array<
    CreateWork & {
      genres: Work["genres"];
      tags: string[];
      studios: string[];
    }
  >,
) {
  const now = Math.floor(Date.now() / 1000);
  const ids: string[] = [];
  db.transaction((tx) => {
    for (const input of inputs) {
      const id = crypto.randomUUID();
      ids.push(id);
      tx.insert(works)
        .values({
          id,
          kind: input.kind,
          canonicalTitle: input.title,
          sortTitle: input.title.toLocaleLowerCase(),
          summary: input.summary,
          releaseYear: input.year,
          status: "released",
          metadata: { palette: "new" },
          createdAt: now,
          updatedAt: now,
        })
        .run();
      tx.insert(workTitles)
        .values({
          id: crypto.randomUUID(),
          workId: id,
          title: input.title,
          titleType: "canonical",
          isPreferred: true,
        })
        .run();
      tx.insert(personalState).values({ workId: id, status: input.status, updatedAt: now }).run();

      for (const [vocabulary, values] of Object.entries({
        genre: input.genres,
        tag: input.tags,
      })) {
        for (const name of [...new Set(values)]) {
          const termSlug = slug(name);
          const term = tx
            .select()
            .from(terms)
            .where(and(eq(terms.vocabulary, vocabulary), eq(terms.slug, termSlug)))
            .get();
          if (!term) throw new Error(`Unknown controlled ${vocabulary} term: ${name}`);
          if (term) {
            tx.insert(workTerms)
              .values({ workId: id, termId: term.id })
              .onConflictDoNothing()
              .run();
          }
        }
      }

      for (const [position, studio] of input.studios.entries()) {
        const sortName = studio.trim().toLocaleLowerCase();
        if (!sortName) continue;
        let entity = tx
          .select()
          .from(entities)
          .where(and(eq(entities.entityType, "organization"), eq(entities.sortName, sortName)))
          .get();
        if (!entity) {
          const entityId = crypto.randomUUID();
          tx.insert(entities)
            .values({
              id: entityId,
              entityType: "organization",
              name: studio.trim(),
              sortName,
            })
            .run();
          entity = tx.select().from(entities).where(eq(entities.id, entityId)).get();
        }
        if (entity) {
          tx.insert(workContributors)
            .values({
              workId: id,
              entityId: entity.id,
              role: "animation-studio",
              isPrimary: position === 0,
              position,
            })
            .onConflictDoNothing()
            .run();
        }
      }
    }
  });
  return { created: ids.length, ids };
}

export function updateWorksBulk(input: {
  workIds: string[];
  kind?: WorkKind;
  audience?: Work["audience"];
  favorite?: boolean;
  addGenres: Work["genres"];
  removeGenres: Work["genres"];
  addTags: string[];
  removeTags: string[];
}) {
  const now = Math.floor(Date.now() / 1000);
  db.transaction((tx) => {
    for (const workId of input.workIds) {
      if (input.kind) {
        tx.update(works)
          .set({ kind: input.kind, updatedAt: now })
          .where(eq(works.id, workId))
          .run();
      }

      for (const [vocabulary, additions, removals] of [
        ["genre", input.addGenres, input.removeGenres],
        ["tag", input.addTags, input.removeTags],
      ] as const) {
        for (const name of removals) {
          const term = tx
            .select()
            .from(terms)
            .where(and(eq(terms.vocabulary, vocabulary), eq(terms.slug, slug(name))))
            .get();
          if (term) {
            tx.delete(workTerms)
              .where(and(eq(workTerms.workId, workId), eq(workTerms.termId, term.id)))
              .run();
          }
        }
        for (const name of additions) {
          const term = tx
            .select()
            .from(terms)
            .where(and(eq(terms.vocabulary, vocabulary), eq(terms.slug, slug(name))))
            .get();
          if (!term) throw new Error(`Unknown controlled ${vocabulary} term: ${name}`);
          if (term) {
            tx.insert(workTerms).values({ workId, termId: term.id }).onConflictDoNothing().run();
          }
        }
      }

      if (input.audience !== undefined) {
        const audienceTerms = tx
          .select({ id: terms.id })
          .from(terms)
          .where(eq(terms.vocabulary, "audience"))
          .all();
        if (audienceTerms.length) {
          tx.delete(workTerms)
            .where(
              and(
                eq(workTerms.workId, workId),
                inArray(
                  workTerms.termId,
                  audienceTerms.map(({ id }) => id),
                ),
              ),
            )
            .run();
        }
        if (input.audience) {
          const term = tx
            .select()
            .from(terms)
            .where(and(eq(terms.vocabulary, "audience"), eq(terms.slug, slug(input.audience))))
            .get();
          if (!term) throw new Error(`Unknown controlled audience term: ${input.audience}`);
          tx.insert(workTerms).values({ workId, termId: term.id }).onConflictDoNothing().run();
        }
      }

      if (input.favorite !== undefined) {
        tx.insert(personalState)
          .values({ workId, favorite: input.favorite, updatedAt: now })
          .onConflictDoUpdate({
            target: personalState.workId,
            set: { favorite: input.favorite, updatedAt: now },
          })
          .run();
      }
    }
  });
  return { updated: input.workIds.length };
}

export function listSavedViews(): SavedUserView[] {
  return db
    .select()
    .from(savedViews)
    .orderBy(desc(savedViews.isPinned), asc(savedViews.name))
    .all()
    .map((row) => {
      const filters = row.filterTree as Partial<
        Pick<
          SavedUserView,
          | "kinds"
          | "excludedKinds"
          | "statuses"
          | "excludedStatuses"
          | "showSaved"
          | "showAnnounced"
          | "showSequelMovies"
          | "minRating"
          | "minScores"
          | "favoriteOnly"
          | "yearFrom"
          | "yearTo"
          | "facets"
        >
      >;
      const display = row.display as {
        gallery?: Partial<SavedUserView["gallery"]>;
        tableDensity?: SavedUserView["tableDensity"];
        timelineNewestFirst?: boolean;
      };
      const galleryMode = display.gallery?.mode ?? "full";
      const icon = savedViewIconSchema.safeParse(row.icon);
      const color = savedViewColorSchema.safeParse(row.color);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        icon: icon.success ? icon.data : "bookmark",
        color: color.success ? color.data : "primary",
        layout: row.layout as SavedUserView["layout"],
        sort: row.sortField as SavedUserView["sort"],
        sortDirection: row.sortDirection as SavedUserView["sortDirection"],
        groupBy: (row.groupBy ?? "none") as SavedUserView["groupBy"],
        kinds: filters.kinds ?? [],
        excludedKinds: filters.excludedKinds ?? [],
        statuses: filters.statuses ?? [],
        excludedStatuses: filters.excludedStatuses ?? [],
        showSaved: filters.showSaved ?? false,
        showAnnounced:
          filters.showAnnounced ??
          Boolean(filters.facets?.releaseStatuses?.include.includes("announced")),
        showSequelMovies: filters.showSequelMovies ?? false,
        minRating: filters.minRating ?? 0,
        minScores: filters.minScores ?? {},
        favoriteOnly: filters.favoriteOnly ?? false,
        yearFrom: filters.yearFrom ?? null,
        yearTo: filters.yearTo ?? null,
        cardSize: row.cardSize,
        gallery: {
          mode: galleryMode,
          imageType: display.gallery?.imageType ?? "poster",
          showType: display.gallery?.showType ?? true,
          showRating: display.gallery?.showRating ?? true,
          showTitle: display.gallery?.showTitle ?? galleryMode !== "cover",
          showFavorite: display.gallery?.showFavorite ?? galleryMode !== "cover",
          showCreator: display.gallery?.showCreator ?? false,
          showYear: display.gallery?.showYear ?? galleryMode === "full",
          showGenres: display.gallery?.showGenres ?? galleryMode === "full",
          showProgress: display.gallery?.showProgress ?? false,
        },
        tableDensity: display.tableDensity ?? "comfortable",
        timelineNewestFirst: display.timelineNewestFirst ?? true,
        facets: filters.facets,
        search: row.search,
        visibleColumns: row.visibleColumns,
        isPinned: row.isPinned,
      };
    });
}

export function createSavedView(
  input: Omit<SavedUserView, "id" | "groupBy" | "timelineNewestFirst"> & {
    groupBy?: SavedUserView["groupBy"];
    timelineNewestFirst?: boolean;
  },
): SavedUserView {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  db.insert(savedViews)
    .values({
      id,
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      layout: input.layout,
      filterTree: {
        kinds: input.kinds,
        excludedKinds: input.excludedKinds,
        statuses: input.statuses,
        excludedStatuses: input.excludedStatuses,
        showSaved: input.showSaved,
        showAnnounced: input.showAnnounced,
        showSequelMovies: input.showSequelMovies,
        minRating: input.minRating,
        minScores: input.minScores,
        favoriteOnly: input.favoriteOnly,
        yearFrom: input.yearFrom,
        yearTo: input.yearTo,
        facets: input.facets,
      },
      sortField: input.sort,
      sortDirection: input.sortDirection,
      groupBy: input.groupBy === "none" ? null : input.groupBy,
      visibleColumns: input.visibleColumns,
      cardSize: input.cardSize,
      search: input.search,
      display: {
        gallery: input.gallery,
        tableDensity: input.tableDensity,
        timelineNewestFirst: input.timelineNewestFirst ?? true,
      },
      isPinned: input.isPinned,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const created = listSavedViews().find((view) => view.id === id);
  if (!created) throw new Error("Could not create saved view");
  return created;
}

export function updateSavedView(
  input: Omit<
    UpdateSavedUserView,
    "groupBy" | "timelineNewestFirst" | "cardSize" | "tableDensity"
  > & {
    groupBy?: UpdateSavedUserView["groupBy"];
    timelineNewestFirst?: boolean;
    cardSize?: number;
    tableDensity?: UpdateSavedUserView["tableDensity"];
  },
): SavedUserView {
  const now = Math.floor(Date.now() / 1000);
  const existing = db.select().from(savedViews).where(eq(savedViews.id, input.id)).get();
  const display = (existing?.display ?? {}) as Record<string, unknown>;
  const result = db
    .update(savedViews)
    .set({
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      layout: input.layout,
      sortField: input.sort,
      sortDirection: input.sortDirection,
      groupBy: input.groupBy === "none" ? null : input.groupBy,
      cardSize: input.cardSize,
      display: {
        ...display,
        tableDensity: input.tableDensity ?? display.tableDensity,
        timelineNewestFirst: input.timelineNewestFirst ?? display.timelineNewestFirst,
      },
      isPinned: input.isPinned,
      updatedAt: now,
    })
    .where(eq(savedViews.id, input.id))
    .run();
  if (result.changes === 0) throw new Error("Saved view not found");
  const updated = listSavedViews().find((view) => view.id === input.id);
  if (!updated) throw new Error("Could not update saved view");
  return updated;
}

export function deleteSavedView(id: string) {
  const result = db.delete(savedViews).where(eq(savedViews.id, id)).run();
  return { id, deleted: result.changes > 0 };
}

export function getWorkStructure(workId: string): WorkStructure {
  databaseWorkExists(workId);
  const seasonRows = db
    .select()
    .from(workSeasons)
    .where(eq(workSeasons.workId, workId))
    .orderBy(asc(workSeasons.position))
    .all();
  const unitRows = db
    .select()
    .from(workUnits)
    .where(eq(workUnits.workId, workId))
    .orderBy(asc(workUnits.position))
    .all();
  const personal = db.select().from(personalState).where(eq(personalState.workId, workId)).get();
  const unitsBySeason = new Map<string, typeof unitRows>();
  for (const unit of unitRows) {
    if (!unit.seasonId) continue;
    const values = unitsBySeason.get(unit.seasonId) ?? [];
    values.push(unit);
    unitsBySeason.set(unit.seasonId, values);
  }
  const personalProgress = Math.max(Math.trunc(personal?.progress ?? 0), 0);
  const seasonProgressById = new Map<string, { progress: number; total: number }>();
  const completedIds = new Set<string>();
  let structureOffset = 0;
  for (const season of seasonRows) {
    const units = unitsBySeason.get(season.id) ?? [];
    const total = Math.max(units.length, season.unitCount ?? 0);
    const progress = Math.min(Math.max(personalProgress - structureOffset, 0), total);
    seasonProgressById.set(season.id, { progress, total });
    for (const unit of units.slice(0, progress)) completedIds.add(unit.id);
    structureOffset += total;
  }
  const ungroupedUnits = unitRows.filter((unit) => !unit.seasonId);
  const ungroupedProgress = Math.min(
    Math.max(personalProgress - structureOffset, 0),
    ungroupedUnits.length,
  );
  for (const unit of ungroupedUnits.slice(0, ungroupedProgress)) {
    completedIds.add(unit.id);
  }
  const totalUnits = structureOffset + ungroupedUnits.length;
  const completedUnits = Math.min(personalProgress, totalUnits);
  const completedAt = personal?.completedAt ?? null;
  const updatedAt = personal?.updatedAt ?? 0;
  const completedProgress = (id: string) => ({
    id: `tracking:${id}`,
    status: "completed" as const,
    progress: 1,
    completedAt,
    updatedAt,
  });
  const mapUnit = (unit: (typeof unitRows)[number]): WorkStructure["ungroupedUnits"][number] => ({
    id: unit.id,
    workId: unit.workId,
    seasonId: unit.seasonId,
    unitType: unit.unitType as "episode" | "chapter" | "volume",
    title: unit.title,
    unitNumber: unit.unitNumber,
    position: unit.position,
    runtimeMinutes: unit.runtimeMinutes,
    pageCount: unit.pageCount,
    releaseAt: unit.releaseAt,
    progress: completedIds.has(unit.id) ? completedProgress(unit.id) : null,
  });

  return {
    workId,
    seasons: seasonRows.map((season) => {
      const units = (unitsBySeason.get(season.id) ?? []).map(mapUnit);
      const seasonProgress = seasonProgressById.get(season.id) ?? {
        progress: 0,
        total: 0,
      };
      const seasonCompleted =
        seasonProgress.total > 0 && seasonProgress.progress === seasonProgress.total;
      return {
        id: season.id,
        workId: season.workId,
        title: season.title,
        seasonNumber: season.seasonNumber,
        position: season.position,
        runtimeMinutes: season.runtimeMinutes,
        unitCount: season.unitCount,
        releaseAt: season.releaseAt,
        progress:
          seasonProgress.progress > 0
            ? {
                id: `tracking:${season.id}`,
                status: seasonCompleted ? "completed" : "in-progress",
                progress: seasonProgress.progress,
                completedAt: seasonCompleted ? completedAt : null,
                updatedAt,
              }
            : null,
        units,
      };
    }),
    ungroupedUnits: ungroupedUnits.map(mapUnit),
    completedUnits,
    totalUnits,
  };
}

export function getEditableWorkStructure(workId: string): EditableWorkStructure {
  const structure = getWorkStructure(workId);
  const mapUnit = (unit: WorkStructure["ungroupedUnits"][number]) => ({
    id: unit.id,
    unitType: unit.unitType,
    title: unit.title,
    unitNumber: unit.unitNumber,
    position: unit.position,
    runtimeMinutes: unit.runtimeMinutes,
    pageCount: unit.pageCount,
    releaseAt: unit.releaseAt,
  });
  return {
    workId,
    seasons: structure.seasons.map((season) => ({
      id: season.id,
      title: season.title,
      seasonNumber: season.seasonNumber,
      position: season.position,
      runtimeMinutes: season.runtimeMinutes,
      unitCount: season.unitCount,
      releaseAt: season.releaseAt,
      units: season.units.map(mapUnit),
    })),
    ungroupedUnits: structure.ungroupedUnits.map(mapUnit),
  };
}

export function replaceWorkStructure(input: EditableWorkStructure) {
  databaseWorkExists(input.workId);
  const allSeasonPositions = input.seasons.map(({ position }) => position);
  if (new Set(allSeasonPositions).size !== allSeasonPositions.length) {
    throw new Error("Season positions must be unique within a work.");
  }
  const allSeasonTitles = input.seasons.map(({ title }) => title.toLocaleLowerCase());
  if (new Set(allSeasonTitles).size !== allSeasonTitles.length) {
    throw new Error("Season titles must be unique within a work.");
  }
  for (const season of input.seasons) {
    const positions = season.units.map(({ position }) => position);
    if (new Set(positions).size !== positions.length) {
      throw new Error(`Unit positions must be unique in ${season.title}.`);
    }
  }
  const ungroupedPositions = input.ungroupedUnits.map(({ position }) => position);
  if (new Set(ungroupedPositions).size !== ungroupedPositions.length) {
    throw new Error("Ungrouped unit positions must be unique.");
  }

  const now = Math.floor(Date.now() / 1000);
  db.transaction((tx) => {
    const existingSeasons = tx
      .select()
      .from(workSeasons)
      .where(eq(workSeasons.workId, input.workId))
      .all();
    const existingUnits = tx
      .select()
      .from(workUnits)
      .where(eq(workUnits.workId, input.workId))
      .all();
    const requestedSeasonIds = new Set(input.seasons.flatMap(({ id }) => (id ? [id] : [])));
    const requestedUnitIds = new Set(
      [...input.seasons.flatMap(({ units }) => units), ...input.ungroupedUnits].flatMap(({ id }) =>
        id ? [id] : [],
      ),
    );
    const removedSeasonIds = existingSeasons
      .filter(({ id }) => !requestedSeasonIds.has(id))
      .map(({ id }) => id);
    const removedUnitIds = existingUnits
      .filter(({ id }) => !requestedUnitIds.has(id))
      .map(({ id }) => id);

    for (const [index, season] of existingSeasons.entries()) {
      tx.update(workSeasons)
        .set({
          title: `__structure_edit_${season.id}`,
          position: 1_000_000 + index,
        })
        .where(eq(workSeasons.id, season.id))
        .run();
    }
    for (const [index, unit] of existingUnits.entries()) {
      tx.update(workUnits)
        .set({ position: 1_000_000 + index })
        .where(eq(workUnits.id, unit.id))
        .run();
    }
    if (removedUnitIds.length) {
      tx.delete(workUnits).where(inArray(workUnits.id, removedUnitIds)).run();
    }
    if (removedSeasonIds.length) {
      tx.delete(workSeasons).where(inArray(workSeasons.id, removedSeasonIds)).run();
    }

    const seasonIds = new Map<string, string>();
    for (const season of input.seasons) {
      const id = season.id ?? crypto.randomUUID();
      const existing = existingSeasons.find((row) => row.id === id);
      const conflictingSeason = season.id
        ? tx.select().from(workSeasons).where(eq(workSeasons.id, season.id)).get()
        : undefined;
      if (!existing && conflictingSeason) {
        throw new Error(`Season ID ${id} belongs to another work.`);
      }
      seasonIds.set(season.title, id);
      if (existing) {
        tx.update(workSeasons)
          .set({
            title: season.title,
            seasonNumber: season.seasonNumber,
            position: season.position,
            runtimeMinutes: season.runtimeMinutes,
            unitCount: season.unitCount,
            releaseAt: season.releaseAt,
            updatedAt: now,
          })
          .where(eq(workSeasons.id, id))
          .run();
      } else {
        tx.insert(workSeasons)
          .values({
            id,
            workId: input.workId,
            title: season.title,
            seasonNumber: season.seasonNumber,
            position: season.position,
            runtimeMinutes: season.runtimeMinutes,
            unitCount: season.unitCount,
            releaseAt: season.releaseAt,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }

    const saveUnit = (
      unit: EditableWorkStructure["ungroupedUnits"][number],
      seasonId: string | null,
    ) => {
      const id = unit.id ?? crypto.randomUUID();
      const existing = existingUnits.find((row) => row.id === id);
      const conflictingUnit = unit.id
        ? tx.select().from(workUnits).where(eq(workUnits.id, unit.id)).get()
        : undefined;
      if (!existing && conflictingUnit) {
        throw new Error(`Unit ID ${id} belongs to another work.`);
      }
      const values = {
        workId: input.workId,
        seasonId,
        unitType: unit.unitType,
        title: unit.title,
        unitNumber: unit.unitNumber,
        position: unit.position,
        runtimeMinutes: unit.runtimeMinutes,
        pageCount: unit.pageCount,
        releaseAt: unit.releaseAt,
        updatedAt: now,
      };
      if (existing) {
        tx.update(workUnits).set(values).where(eq(workUnits.id, id)).run();
      } else {
        tx.insert(workUnits)
          .values({ id, ...values, createdAt: now })
          .run();
      }
    };
    for (const season of input.seasons) {
      const seasonId = seasonIds.get(season.title);
      if (!seasonId) throw new Error(`Could not resolve ${season.title}.`);
      for (const unit of season.units) saveUnit(unit, seasonId);
    }
    for (const unit of input.ungroupedUnits) saveUnit(unit, null);
  });
  return getEditableWorkStructure(input.workId);
}

export function createWorkSeason(input: {
  workId: string;
  title: string;
  seasonNumber?: number | null;
  position: number;
  runtimeMinutes?: number | null;
  unitCount?: number | null;
  releaseAt?: number | null;
}) {
  const id = crypto.randomUUID();
  databaseWorkExists(input.workId);
  db.insert(workSeasons)
    .values({ id, ...input })
    .run();
  const created = db.select().from(workSeasons).where(eq(workSeasons.id, id)).get();
  if (!created) throw new Error("Could not create season");
  return created;
}

export function createWorkUnit(input: {
  workId: string;
  seasonId?: string | null;
  unitType: "episode" | "chapter" | "volume";
  title?: string | null;
  unitNumber?: number | null;
  position: number;
  runtimeMinutes?: number | null;
  pageCount?: number | null;
  releaseAt?: number | null;
}) {
  const id = crypto.randomUUID();
  databaseWorkExists(input.workId);
  db.insert(workUnits)
    .values({ id, ...input })
    .run();
  const created = db.select().from(workUnits).where(eq(workUnits.id, id)).get();
  if (!created) throw new Error("Could not create unit");
  return created;
}

function databaseWorkExists(workId: string) {
  const work = db.select().from(works).where(eq(works.id, workId)).get();
  if (!work) throw new Error("Work not found");
}

function currentWorkMetric(workId: string) {
  const work = db.select().from(works).where(eq(works.id, workId)).get();
  if (!work) throw new Error("Work not found");
  const units = db
    .select({ unitType: workUnits.unitType })
    .from(workUnits)
    .where(eq(workUnits.workId, workId))
    .all();
  return {
    ...deriveProgressMetric(
      work,
      units.length > 0 ? { count: units.length, unitType: units[0].unitType } : undefined,
    ),
    kind: work.kind as WorkKind,
  };
}

function completedAtForDate(occurredOn: string) {
  return Math.floor(Date.parse(`${occurredOn}T00:00:00.000Z`) / 1000);
}

function trackingInitialStatus(workId: string): TrackingEntry["status"] {
  const earliest = db
    .select({ statusBefore: trackingEntries.statusBefore })
    .from(trackingEntries)
    .where(and(eq(trackingEntries.workId, workId), isNull(trackingEntries.voidedAt)))
    .orderBy(
      asc(trackingEntries.occurredOn),
      asc(trackingEntries.daySequence),
      asc(trackingEntries.id),
    )
    .limit(1)
    .get();
  if (earliest) return earliest.statusBefore as TrackingEntry["status"];
  const personal = db
    .select({ status: personalState.status })
    .from(personalState)
    .where(eq(personalState.workId, workId))
    .get();
  return (personal?.status ?? "saved") as TrackingEntry["status"];
}

function rebuildCurrentProjection(
  workId: string,
  fallbackStatus: TrackingEntry["status"] = trackingInitialStatus(workId),
) {
  const latest = db
    .select()
    .from(trackingEntries)
    .where(and(eq(trackingEntries.workId, workId), isNull(trackingEntries.voidedAt)))
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence),
      desc(trackingEntries.id),
    )
    .limit(1)
    .get();
  const metric = currentWorkMetric(workId);
  const now = Math.floor(Date.now() / 1000);
  const status = latest?.status ?? fallbackStatus;
  db.insert(personalState)
    .values({
      workId,
      status,
      progress: latest?.progress ?? 0,
      progressTotal: metric.total,
      progressUnit: metric.unit,
      completedAt: status === "completed" && latest ? completedAtForDate(latest.occurredOn) : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: personalState.workId,
      set: {
        status,
        progress: latest?.progress ?? 0,
        progressTotal: metric.total,
        progressUnit: metric.unit,
        completedAt:
          status === "completed" && latest ? completedAtForDate(latest.occurredOn) : null,
        updatedAt: now,
      },
    })
    .run();
}

function rebuildTrackingTransitions(
  workId: string,
  initialStatus: TrackingEntry["status"] = trackingInitialStatus(workId),
) {
  const entries = db
    .select({
      id: trackingEntries.id,
      progress: trackingEntries.progress,
      status: trackingEntries.status,
    })
    .from(trackingEntries)
    .where(and(eq(trackingEntries.workId, workId), isNull(trackingEntries.voidedAt)))
    .orderBy(
      asc(trackingEntries.occurredOn),
      asc(trackingEntries.daySequence),
      asc(trackingEntries.id),
    )
    .all();

  let progressBefore = 0;
  let statusBefore: TrackingEntry["status"] = initialStatus;
  db.transaction((tx) => {
    for (const entry of entries) {
      tx.update(trackingEntries)
        .set({ progressBefore, statusBefore })
        .where(eq(trackingEntries.id, entry.id))
        .run();
      progressBefore = entry.progress;
      statusBefore = entry.status as TrackingEntry["status"];
    }
  });
}

function cleanTrackingEntry(row: typeof trackingEntries.$inferSelect): TrackingEntry {
  return {
    id: row.id,
    workId: row.workId,
    progressBefore: row.progressBefore,
    progress: row.progress,
    statusBefore: row.statusBefore as TrackingEntry["statusBefore"],
    status: row.status as TrackingEntry["status"],
    occurredOn: row.occurredOn,
    daySequence: row.daySequence,
    recordedAt: row.recordedAt,
  };
}

export function recordTrackingEntry(input: RecordTrackingEntry): TrackingEntry {
  const parsed = recordTrackingEntrySchema.parse(input);
  const initialStatus = trackingInitialStatus(parsed.workId);
  const metric = currentWorkMetric(parsed.workId);
  if (!["episodes", "chapters"].includes(metric.unit) && parsed.progress !== 0) {
    throw new Error("This work uses status-only tracking.");
  }
  if (metric.total !== null && parsed.progress > metric.total) {
    throw new Error(`Progress cannot exceed the known total of ${metric.total}.`);
  }
  if (["saved", "planned"].includes(parsed.status) && parsed.progress !== 0) {
    throw new Error("Saved and planned entries require zero progress.");
  }
  if (parsed.status === "completed" && metric.total !== null && parsed.progress !== metric.total) {
    throw new Error("Completed entries must equal the known total.");
  }
  if (metric.total !== null && parsed.progress === metric.total && parsed.status !== "completed") {
    throw new Error("Reaching the known total requires completed status.");
  }

  const id = crypto.randomUUID();
  const recordedAt = Math.floor(Date.now() / 1000);
  db.transaction((tx) => {
    const latestOnDay = tx
      .select({ daySequence: trackingEntries.daySequence })
      .from(trackingEntries)
      .where(
        and(
          eq(trackingEntries.workId, parsed.workId),
          eq(trackingEntries.occurredOn, parsed.occurredOn),
        ),
      )
      .orderBy(desc(trackingEntries.daySequence))
      .limit(1)
      .get();
    tx.insert(trackingEntries)
      .values({
        id,
        ...parsed,
        daySequence: (latestOnDay?.daySequence ?? -1) + 1,
        recordedAt,
      })
      .run();
  });
  rebuildTrackingTransitions(parsed.workId, initialStatus);
  rebuildCurrentProjection(parsed.workId, initialStatus);
  const created = db.select().from(trackingEntries).where(eq(trackingEntries.id, id)).get();
  if (!created) throw new Error("Could not record tracking entry.");
  return cleanTrackingEntry(created);
}

export function listWorkTrackingEntries(workId: string, limit = 200): TrackingEntry[] {
  databaseWorkExists(workId);
  return db
    .select()
    .from(trackingEntries)
    .where(and(eq(trackingEntries.workId, workId), isNull(trackingEntries.voidedAt)))
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence),
      desc(trackingEntries.id),
    )
    .limit(Math.min(Math.max(limit, 1), 10_000))
    .all()
    .map(cleanTrackingEntry);
}

export function getTrackingBaseline(workId: string, occurredOn: string) {
  databaseWorkExists(workId);
  const entry = db
    .select()
    .from(trackingEntries)
    .where(
      and(
        eq(trackingEntries.workId, workId),
        lte(trackingEntries.occurredOn, occurredOn),
        isNull(trackingEntries.voidedAt),
      ),
    )
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence),
      desc(trackingEntries.id),
    )
    .limit(1)
    .get();
  return {
    progress: entry?.progress ?? 0,
    status: (entry?.status ?? trackingInitialStatus(workId)) as TrackingEntry["status"],
  };
}

export function listTrackingPage(input: TrackingPageInput) {
  const conditions = [isNull(trackingEntries.voidedAt)];
  if (input.workId) conditions.push(eq(trackingEntries.workId, input.workId));
  if (input.statuses?.length) {
    conditions.push(inArray(trackingEntries.status, input.statuses));
  }
  if (input.dateFrom) {
    conditions.push(gte(trackingEntries.occurredOn, input.dateFrom));
  }
  if (input.dateTo) {
    conditions.push(lte(trackingEntries.occurredOn, input.dateTo));
  }
  if (input.cursor) {
    const cursor = input.cursor;
    const cursorCondition = or(
      lt(trackingEntries.occurredOn, cursor.occurredOn),
      and(
        eq(trackingEntries.occurredOn, cursor.occurredOn),
        lt(trackingEntries.daySequence, cursor.daySequence),
      ),
      and(
        eq(trackingEntries.occurredOn, cursor.occurredOn),
        eq(trackingEntries.daySequence, cursor.daySequence),
        lt(trackingEntries.id, cursor.id),
      ),
    );
    if (cursorCondition) conditions.push(cursorCondition);
  }
  const limit = Math.min(Math.max(input.limit, 1), 10_000);
  const rows = db
    .select()
    .from(trackingEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence),
      desc(trackingEntries.id),
    )
    .limit(limit + 1)
    .all();
  const items = rows.slice(0, limit).map(cleanTrackingEntry);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? {
            occurredOn: last.occurredOn,
            daySequence: last.daySequence,
            id: last.id,
          }
        : null,
  };
}

export function removeTrackingEntry(entryId: string) {
  const entry = db.select().from(trackingEntries).where(eq(trackingEntries.id, entryId)).get();
  if (!entry || entry.voidedAt) return { entryId, removed: false };
  const initialStatus = trackingInitialStatus(entry.workId);
  db.update(trackingEntries)
    .set({ voidedAt: Math.floor(Date.now() / 1000), voidReason: "Removed from activity feed" })
    .where(eq(trackingEntries.id, entryId))
    .run();
  rebuildTrackingTransitions(entry.workId, initialStatus);
  rebuildCurrentProjection(entry.workId, initialStatus);
  return { entryId, workId: entry.workId, removed: true };
}
