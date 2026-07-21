import { and, asc, eq, inArray, or } from "drizzle-orm"
import type {
  AdminWorkUpdate,
  CreateWork,
  Work,
  WorkCredit,
  WorkKind,
  WorkRelation,
} from "@/features/library/model"
import { db } from "./client"
import {
  assets,
  entities,
  personalState,
  workCredits,
  workRelations,
  works,
} from "./schema"

type WorkMetadata = Partial<
  Pick<
    Work,
    | "subtitle"
    | "tags"
    | "creator"
    | "palette"
    | "genres"
    | "aliases"
    | "studios"
    | "favoriteCharacters"
    | "audience"
    | "sharedWith"
    | "tone"
    | "contentWarnings"
    | "analysisNotes"
    | "riskProfile"
    | "scoreBreakdown"
    | "externalLinks"
    | "releaseStart"
    | "releaseEnd"
    | "watchDates"
    | "country"
    | "sourceMaterial"
    | "publication"
    | "curation"
  >
>

export function listWorks(): Work[] {
  const rows = db
    .select({ work: works, personal: personalState })
    .from(works)
    .leftJoin(personalState, eq(personalState.workId, works.id))
    .orderBy(asc(works.sortTitle))
    .all()

  const workIds = rows.map(({ work }) => work.id)
  const workAssets = workIds.length
    ? db.select().from(assets).where(inArray(assets.ownerId, workIds)).all()
    : []
  const assetsByWork = new Map<string, Map<string, string>>()
  for (const asset of workAssets) {
    if (asset.ownerType !== "work") continue
    const byType = assetsByWork.get(asset.ownerId) ?? new Map<string, string>()
    if (!byType.has(asset.assetType)) {
      byType.set(asset.assetType, asset.relativePath)
    }
    assetsByWork.set(asset.ownerId, byType)
  }

  const creditRows = workIds.length
    ? db
        .select({ credit: workCredits, entity: entities })
        .from(workCredits)
        .innerJoin(entities, eq(workCredits.entityId, entities.id))
        .where(inArray(workCredits.workId, workIds))
        .all()
    : []
  const creditsByWork = new Map<string, WorkCredit[]>()
  for (const { credit, entity } of creditRows) {
    const workCreditsForWork = creditsByWork.get(credit.workId) ?? []
    workCreditsForWork.push({
      entityId: entity.id,
      name: entity.name,
      entityType: entity.entityType,
      role: credit.role,
    })
    creditsByWork.set(credit.workId, workCreditsForWork)
  }

  const relationRows = workIds.length
    ? db
        .select()
        .from(workRelations)
        .where(
          or(
            inArray(workRelations.sourceWorkId, workIds),
            inArray(workRelations.targetWorkId, workIds)
          )
        )
        .all()
    : []
  const workRowsById = new Map(rows.map(({ work }) => [work.id, work]))
  const relationsByWork = new Map<string, WorkRelation[]>()
  for (const relation of relationRows) {
    const source = workRowsById.get(relation.sourceWorkId)
    const target = workRowsById.get(relation.targetWorkId)
    if (!source || !target) continue
    const append = (
      workId: string,
      related: typeof works.$inferSelect,
      direction: WorkRelation["direction"]
    ) => {
      const relations = relationsByWork.get(workId) ?? []
      const media = assetsByWork.get(related.id)
      relations.push({
        id: relation.id,
        workId: related.id,
        relationType: relation.relationType as WorkRelation["relationType"],
        direction,
        notes: relation.notes,
        work: {
          id: related.id,
          title: related.canonicalTitle,
          kind: related.kind as WorkKind,
          year: related.releaseYear,
          releaseStatus: related.status as Work["releaseStatus"],
          imagePath: media?.get("poster") ?? null,
        },
      })
      relationsByWork.set(workId, relations)
    }
    append(source.id, target, "outgoing")
    append(target.id, source, "incoming")
  }

  return rows.map(({ work, personal }) => {
    const metadata = work.metadata as WorkMetadata
    const media = assetsByWork.get(work.id)
    return {
      id: work.id,
      title: work.canonicalTitle,
      subtitle: metadata.subtitle ?? "",
      kind: work.kind as WorkKind,
      year: work.releaseYear,
      releaseStatus: work.status as Work["releaseStatus"],
      status: (personal?.status ?? "planned") as Work["status"],
      progress: personal?.progress ?? 0,
      progressTotal: personal?.progressTotal ?? null,
      progressUnit: personal?.progressUnit ?? "",
      rating: personal?.rating ?? null,
      favorite: personal?.favorite ?? false,
      summary: work.summary,
      tags: metadata.tags ?? [],
      genres: metadata.genres ?? [],
      aliases: metadata.aliases ?? [],
      studios: metadata.studios ?? [],
      favoriteCharacters: metadata.favoriteCharacters ?? [],
      audience: metadata.audience ?? [],
      sharedWith: metadata.sharedWith ?? [],
      tone: metadata.tone ?? [],
      contentWarnings: metadata.contentWarnings ?? null,
      analysisNotes: metadata.analysisNotes ?? null,
      riskProfile: metadata.riskProfile ?? null,
      scoreBreakdown: metadata.scoreBreakdown ?? {},
      externalLinks: metadata.externalLinks ?? [],
      releaseStart: metadata.releaseStart ?? null,
      releaseEnd: metadata.releaseEnd ?? null,
      watchDates: metadata.watchDates ?? null,
      country: metadata.country ?? [],
      sourceMaterial: metadata.sourceMaterial ?? null,
      publication: metadata.publication ?? null,
      curation: metadata.curation ?? null,
      credits: creditsByWork.get(work.id) ?? [],
      relations: relationsByWork.get(work.id) ?? [],
      notes: personal?.notes ?? "",
      creator: metadata.creator ?? "Unknown creator",
      imagePath: media?.get("poster") ?? null,
      bannerPath: media?.get("banner") ?? null,
      logoPath: media?.get("logo") ?? null,
      palette: metadata.palette ?? "new",
      addedAt: work.createdAt,
    }
  })
}

export function createWork(input: CreateWork): Work {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  db.insert(works)
    .values({
      id,
      kind: input.kind,
      canonicalTitle: input.title,
      sortTitle: input.title.toLocaleLowerCase(),
      summary: input.summary,
      releaseYear: input.year,
      status: "released",
      metadata: {
        subtitle: "New local entry",
        tags: ["Unsorted"],
        creator: "Creator not set",
        palette: "new",
      },
      createdAt: now,
      updatedAt: now,
    })
    .run()
  db.insert(personalState).values({ workId: id, status: input.status }).run()

  const created = listWorks().find((work) => work.id === id)
  if (!created) throw new Error("Could not create work")
  return created
}

export function updateFavorite(workId: string, favorite: boolean) {
  db.update(personalState)
    .set({ favorite, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(personalState.workId, workId))
    .run()
  return { workId, favorite }
}

function mimeTypeForPath(path: string) {
  const extension = path.split(".").pop()?.toLocaleLowerCase()
  if (extension === "png") return "image/png"
  if (extension === "webp") return "image/webp"
  if (extension === "gif") return "image/gif"
  return "image/jpeg"
}

export function updateWork(input: AdminWorkUpdate): Work {
  const existing = db.select().from(works).where(eq(works.id, input.id)).get()
  if (!existing) throw new Error("Work not found")
  const now = Math.floor(Date.now() / 1000)
  const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>
  const metadata: WorkMetadata = {
    ...existingMetadata,
    subtitle: input.subtitle,
    tags: input.tags,
    creator: input.creator,
    genres: input.genres,
    aliases: input.aliases,
    studios: input.studios,
    favoriteCharacters: input.favoriteCharacters,
    audience: input.audience,
    sharedWith: input.sharedWith,
    tone: input.tone,
    contentWarnings: input.contentWarnings,
    analysisNotes: input.analysisNotes,
    riskProfile: input.riskProfile,
    scoreBreakdown: input.scoreBreakdown,
    externalLinks: input.externalLinks,
    releaseStart: input.releaseStart,
    releaseEnd: input.releaseEnd,
    watchDates: input.watchDates,
    country: input.country,
    sourceMaterial: input.sourceMaterial,
    publication: input.publication,
    curation: input.curation,
  }

  db.transaction((tx) => {
    tx.update(works)
      .set({
        kind: input.kind,
        canonicalTitle: input.title,
        sortTitle: input.title.toLocaleLowerCase(),
        summary: input.summary,
        releaseYear: input.year,
        status: input.releaseStatus,
        metadata,
        updatedAt: now,
      })
      .where(eq(works.id, input.id))
      .run()
    tx.insert(personalState)
      .values({
        workId: input.id,
        status: input.status,
        rating: input.rating,
        favorite: input.favorite,
        progress: input.progress,
        progressTotal: input.progressTotal,
        progressUnit: input.progressUnit,
        notes: input.notes,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: personalState.workId,
        set: {
          status: input.status,
          rating: input.rating,
          favorite: input.favorite,
          progress: input.progress,
          progressTotal: input.progressTotal,
          progressUnit: input.progressUnit,
          notes: input.notes,
          updatedAt: now,
        },
      })
      .run()

    tx.delete(workCredits).where(eq(workCredits.workId, input.id)).run()
    for (const credit of input.credits) {
      const sortName = credit.name.toLocaleLowerCase()
      const entity = tx
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.entityType, credit.entityType),
            eq(entities.sortName, sortName)
          )
        )
        .get()
      const entityId = entity?.id ?? crypto.randomUUID()
      if (!entity) {
        tx.insert(entities)
          .values({
            id: entityId,
            entityType: credit.entityType,
            name: credit.name,
            sortName,
          })
          .run()
      }
      tx.insert(workCredits)
        .values({ workId: input.id, entityId, role: credit.role })
        .onConflictDoNothing()
        .run()
    }

    tx.delete(workRelations)
      .where(
        or(
          eq(workRelations.sourceWorkId, input.id),
          eq(workRelations.targetWorkId, input.id)
        )
      )
      .run()
    const uniqueRelations = new Map<string, (typeof input.relations)[number]>()
    for (const relation of input.relations) {
      if (relation.workId === input.id) continue
      const sourceWorkId =
        relation.direction === "outgoing" ? input.id : relation.workId
      const targetWorkId =
        relation.direction === "outgoing" ? relation.workId : input.id
      uniqueRelations.set(
        `${sourceWorkId}:${targetWorkId}:${relation.relationType}`,
        relation
      )
    }
    for (const relation of uniqueRelations.values()) {
      const sourceWorkId =
        relation.direction === "outgoing" ? input.id : relation.workId
      const targetWorkId =
        relation.direction === "outgoing" ? relation.workId : input.id
      tx.insert(workRelations)
        .values({
          id: crypto.randomUUID(),
          sourceWorkId,
          targetWorkId,
          relationType: relation.relationType,
          notes: relation.notes,
        })
        .run()
    }

    const paths = {
      poster: input.imagePath,
      banner: input.bannerPath,
      logo: input.logoPath,
    }
    for (const [assetType, relativePath] of Object.entries(paths)) {
      const current = tx
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.ownerType, "work"),
            eq(assets.ownerId, input.id),
            eq(assets.assetType, assetType)
          )
        )
        .get()
      if (relativePath && current) {
        tx.update(assets)
          .set({ relativePath, mimeType: mimeTypeForPath(relativePath) })
          .where(eq(assets.id, current.id))
          .run()
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
          .run()
      } else if (current) {
        tx.delete(assets).where(eq(assets.id, current.id)).run()
      }
    }
  })

  const updated = listWorks().find((work) => work.id === input.id)
  if (!updated) throw new Error("Could not reload updated work")
  return updated
}

export function createWorksBulk(
  inputs: Array<
    CreateWork & { genres: string[]; tags: string[]; studios: string[] }
  >
) {
  const now = Math.floor(Date.now() / 1000)
  const ids: string[] = []
  db.transaction((tx) => {
    for (const input of inputs) {
      const id = crypto.randomUUID()
      ids.push(id)
      tx.insert(works)
        .values({
          id,
          kind: input.kind,
          canonicalTitle: input.title,
          sortTitle: input.title.toLocaleLowerCase(),
          summary: input.summary,
          releaseYear: input.year,
          status: "released",
          metadata: {
            subtitle: "",
            genres: input.genres,
            tags: input.tags,
            studios: input.studios,
            creator: input.studios[0] ?? "Unknown creator",
            palette: "new",
          },
          createdAt: now,
          updatedAt: now,
        })
        .run()
      tx.insert(personalState)
        .values({ workId: id, status: input.status, updatedAt: now })
        .run()
    }
  })
  return { created: ids.length, ids }
}

export function updateWorksBulk(input: {
  workIds: string[]
  kind?: WorkKind
  status?: Work["status"]
  rating?: number | null
  favorite?: boolean
  addGenres: string[]
  removeGenres: string[]
  addTags: string[]
  removeTags: string[]
}) {
  const now = Math.floor(Date.now() / 1000)
  db.transaction((tx) => {
    for (const workId of input.workIds) {
      const current = tx.select().from(works).where(eq(works.id, workId)).get()
      if (!current) continue
      const metadata = (current.metadata ?? {}) as WorkMetadata
      const genres = new Set(metadata.genres ?? [])
      const tags = new Set(metadata.tags ?? [])
      input.addGenres.forEach((value) => genres.add(value))
      input.removeGenres.forEach((value) => genres.delete(value))
      input.addTags.forEach((value) => tags.add(value))
      input.removeTags.forEach((value) => tags.delete(value))
      tx.update(works)
        .set({
          ...(input.kind ? { kind: input.kind } : {}),
          metadata: { ...metadata, genres: [...genres], tags: [...tags] },
          updatedAt: now,
        })
        .where(eq(works.id, workId))
        .run()
      if (
        input.status !== undefined ||
        input.rating !== undefined ||
        input.favorite !== undefined
      ) {
        tx.insert(personalState)
          .values({
            workId,
            status: input.status ?? "planned",
            rating: input.rating,
            favorite: input.favorite ?? false,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: personalState.workId,
            set: {
              ...(input.status !== undefined ? { status: input.status } : {}),
              ...(input.rating !== undefined ? { rating: input.rating } : {}),
              ...(input.favorite !== undefined
                ? { favorite: input.favorite }
                : {}),
              updatedAt: now,
            },
          })
          .run()
      }
    }
  })
  return { updated: input.workIds.length }
}
