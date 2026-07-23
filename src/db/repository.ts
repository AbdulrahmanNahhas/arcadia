import { and, asc, desc, eq, gte, inArray, lt, lte, ne, or } from "drizzle-orm"
import { recordTrackingEntrySchema } from "@/features/library/model"
import type {
  AdminWorkUpdate,
  CreateWork,
  EditableWorkStructure,
  RecordTrackingEntry,
  SavedUserView,
  TrackingEntry,
  TrackingPageInput,
  Work,
  WorkCredit,
  WorkKind,
  WorkRelation,
  WorkStructure,
} from "@/features/library/model"
import { db } from "./client"
import {
  assets,
  entities,
  externalLinks,
  personalState,
  savedViews,
  terms,
  trackingEntries,
  workCredits,
  workRelations,
  workSeasons,
  works,
  workTerms,
  workTitles,
  workUnits,
} from "./schema"

type WorkDetails = Partial<
  Pick<
    Work,
    | "subtitle"
    | "palette"
    | "audience"
    | "sharedWith"
    | "contentWarnings"
    | "analysisNotes"
    | "riskProfile"
    | "scoreBreakdown"
    | "releaseStart"
    | "releaseEnd"
    | "watchDates"
    | "country"
    | "sourceMaterial"
    | "publication"
    | "curation"
  >
>

const forbiddenDetailKeys = [
  "aliases",
  "creator",
  "externalLinks",
  "favoriteCharacters",
  "genres",
  "studios",
  "tags",
  "tone",
] as const

function normalizedDetails(
  details: Record<string, unknown> | null | undefined
): WorkDetails {
  const next = { ...(details ?? {}) }
  for (const key of forbiddenDetailKeys) delete next[key]
  if (next.publication && typeof next.publication === "object") {
    const publication = { ...next.publication } as Record<string, unknown>
    delete publication.demographic
    next.publication = publication
  }
  return next
}

function slug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function mimeTypeForPath(path: string) {
  const extension = path.split(".").pop()?.toLocaleLowerCase()
  if (extension === "png") return "image/png"
  if (extension === "webp") return "image/webp"
  if (extension === "gif") return "image/gif"
  return "image/jpeg"
}

function deriveProgressMetric(
  work: typeof works.$inferSelect,
  structure?: { count: number; unitType: string }
) {
  if (structure && structure.count > 0) {
    return {
      total: structure.count,
      unit: `${structure.unitType}${structure.unitType.endsWith("s") ? "" : "s"}`,
    }
  }
  const candidates: Array<[number | null, string]> =
    work.kind === "movie"
      ? [[work.runtimeMinutes, "minutes"]]
      : work.kind === "series" || work.kind === "anime"
        ? [[work.episodeCount, "episodes"]]
        : work.kind === "manga" || work.kind === "comic"
          ? [
              [work.chapterCount, "chapters"],
              [work.pageCount, "pages"],
            ]
          : work.kind === "novel"
            ? [[work.pageCount, "pages"]]
            : [
                [work.episodeCount, "episodes"],
                [work.chapterCount, "chapters"],
                [work.pageCount, "pages"],
                [work.runtimeMinutes, "minutes"],
              ]
  const known = candidates.find(([total]) => total !== null)
  return known
    ? { total: known[0], unit: known[1] }
    : { total: null, unit: "unit" }
}

export function listWorks(): Work[] {
  const rows = db
    .select({ work: works, personal: personalState })
    .from(works)
    .leftJoin(personalState, eq(personalState.workId, works.id))
    .orderBy(asc(works.sortTitle))
    .all()

  const workIds = rows.map(({ work }) => work.id)
  if (workIds.length === 0) return []

  const structuralUnits = db
    .select({ workId: workUnits.workId, unitType: workUnits.unitType })
    .from(workUnits)
    .where(inArray(workUnits.workId, workIds))
    .all()
  const structureByWork = new Map<string, { count: number; unitType: string }>()
  for (const unit of structuralUnits) {
    const current = structureByWork.get(unit.workId)
    structureByWork.set(unit.workId, {
      count: (current?.count ?? 0) + 1,
      unitType: current?.unitType ?? unit.unitType,
    })
  }

  const workAssets = db
    .select()
    .from(assets)
    .where(inArray(assets.ownerId, workIds))
    .all()
  const assetsByWork = new Map<string, Map<string, string>>()
  for (const asset of workAssets) {
    if (asset.ownerType !== "work") continue
    const byType = assetsByWork.get(asset.ownerId) ?? new Map<string, string>()
    if (!byType.has(asset.assetType)) {
      byType.set(asset.assetType, asset.relativePath)
    }
    assetsByWork.set(asset.ownerId, byType)
  }

  const titleRows = db
    .select()
    .from(workTitles)
    .where(inArray(workTitles.workId, workIds))
    .all()
  const aliasesByWork = new Map<string, string[]>()
  for (const title of titleRows) {
    if (title.titleType === "canonical") continue
    const values = aliasesByWork.get(title.workId) ?? []
    if (!values.includes(title.title)) values.push(title.title)
    aliasesByWork.set(title.workId, values)
  }

  const termRows = db
    .select({ workId: workTerms.workId, term: terms })
    .from(workTerms)
    .innerJoin(terms, eq(workTerms.termId, terms.id))
    .where(inArray(workTerms.workId, workIds))
    .all()
  const termsByWork = new Map<string, Map<string, string[]>>()
  for (const { workId, term } of termRows) {
    const byVocabulary = termsByWork.get(workId) ?? new Map<string, string[]>()
    const values = byVocabulary.get(term.vocabulary) ?? []
    if (!values.includes(term.name)) values.push(term.name)
    byVocabulary.set(term.vocabulary, values)
    termsByWork.set(workId, byVocabulary)
  }

  const linkRows = db
    .select()
    .from(externalLinks)
    .where(
      and(
        eq(externalLinks.ownerType, "work"),
        inArray(externalLinks.ownerId, workIds)
      )
    )
    .all()
  const linksByWork = new Map<string, Work["externalLinks"]>()
  for (const link of linkRows) {
    const values = linksByWork.get(link.ownerId) ?? []
    values.push({
      provider: link.provider,
      label: link.label || link.provider,
      url: link.url,
    })
    linksByWork.set(link.ownerId, values)
  }

  const creditRows = db
    .select({ credit: workCredits, entity: entities })
    .from(workCredits)
    .innerJoin(entities, eq(workCredits.entityId, entities.id))
    .where(inArray(workCredits.workId, workIds))
    .orderBy(asc(workCredits.position))
    .all()
  const creditsByWork = new Map<string, WorkCredit[]>()
  for (const { credit, entity } of creditRows) {
    const values = creditsByWork.get(credit.workId) ?? []
    values.push({
      entityId: entity.id,
      name: entity.name,
      entityType: entity.entityType as WorkCredit["entityType"],
      role: credit.role as WorkCredit["role"],
    })
    creditsByWork.set(credit.workId, values)
  }

  const relationRows = db
    .select()
    .from(workRelations)
    .where(
      or(
        inArray(workRelations.sourceWorkId, workIds),
        inArray(workRelations.targetWorkId, workIds)
      )
    )
    .all()
  const latestTrackingByWork = new Map<string, string>()
  for (const entry of db
    .select({
      workId: trackingEntries.workId,
      occurredOn: trackingEntries.occurredOn,
    })
    .from(trackingEntries)
    .where(inArray(trackingEntries.workId, workIds))
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence)
    )
    .all()) {
    if (!latestTrackingByWork.has(entry.workId)) {
      latestTrackingByWork.set(entry.workId, entry.occurredOn)
    }
  }

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
    const details = normalizedDetails(work.metadata)
    const metric = deriveProgressMetric(work, structureByWork.get(work.id))
    const media = assetsByWork.get(work.id)
    const taxonomy = termsByWork.get(work.id)
    const credits = creditsByWork.get(work.id) ?? []
    const primaryCreators = credits.filter(({ role }) =>
      ["author", "creator", "director"].includes(role)
    )
    const studios = credits
      .filter(({ role }) => role === "main-studio")
      .map(({ name }) => name)
    const creatorNames = primaryCreators.map(({ name }) => name)

    return {
      id: work.id,
      title: work.canonicalTitle,
      subtitle: details.subtitle ?? "",
      kind: work.kind as WorkKind,
      year: work.releaseYear,
      releaseStatus: work.status as Work["releaseStatus"],
      runtimeMinutes: work.runtimeMinutes,
      pageCount: work.pageCount,
      episodeCount: work.episodeCount,
      chapterCount: work.chapterCount,
      status: (personal?.status ?? "planned") as Work["status"],
      progress: personal?.progress ?? 0,
      progressTotal: metric.total,
      progressUnit: metric.unit,
      rating: personal?.rating ?? null,
      favorite: personal?.favorite ?? false,
      completedAt: personal?.completedAt ?? null,
      trackedOn: latestTrackingByWork.get(work.id) ?? null,
      summary: work.summary,
      tags: taxonomy?.get("tag") ?? [],
      genres: taxonomy?.get("genre") ?? [],
      aliases: aliasesByWork.get(work.id) ?? [],
      studios,
      audience: taxonomy?.get("audience") ?? details.audience ?? [],
      sharedWith: details.sharedWith ?? [],
      tone: taxonomy?.get("tone") ?? [],
      contentWarnings: details.contentWarnings ?? null,
      analysisNotes: details.analysisNotes ?? null,
      riskProfile: details.riskProfile ?? null,
      scoreBreakdown: details.scoreBreakdown ?? {},
      externalLinks: linksByWork.get(work.id) ?? [],
      releaseStart: details.releaseStart ?? null,
      releaseEnd: details.releaseEnd ?? null,
      watchDates: details.watchDates ?? null,
      country: taxonomy?.get("country") ?? details.country ?? [],
      sourceMaterial: details.sourceMaterial ?? null,
      publication: details.publication ?? null,
      curation: details.curation ?? null,
      credits,
      relations: relationsByWork.get(work.id) ?? [],
      creator:
        creatorNames.join(" · ") || studios.join(" · ") || "Unknown creator",
      imagePath: media?.get("poster") ?? null,
      bannerPath: media?.get("banner") ?? null,
      logoPath: media?.get("logo") ?? null,
      palette: details.palette ?? "new",
      addedAt: work.createdAt,
      catalogUpdatedAt: work.updatedAt,
      personalUpdatedAt: personal?.updatedAt ?? work.updatedAt,
    }
  })
}

export function createWork(input: CreateWork): Work {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
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
        metadata: { subtitle: "New local entry", palette: "new" },
        createdAt: now,
        updatedAt: now,
      })
      .run()
    tx.insert(workTitles)
      .values({
        id: crypto.randomUUID(),
        workId: id,
        title: input.title,
        titleType: "canonical",
        isPreferred: true,
      })
      .run()
    tx.insert(personalState)
      .values({ workId: id, status: "planned", updatedAt: now })
      .run()
  })

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

export function updateWork(input: AdminWorkUpdate): Work {
  const existing = db
    .select({ work: works, personal: personalState })
    .from(works)
    .leftJoin(personalState, eq(personalState.workId, works.id))
    .where(eq(works.id, input.id))
    .get()
  if (!existing) throw new Error("Work not found")

  const now = Math.floor(Date.now() / 1000)
  const details: WorkDetails = {
    ...normalizedDetails(existing.work.metadata),
    subtitle: input.subtitle,
    palette: normalizedDetails(existing.work.metadata).palette,
    audience: undefined,
    sharedWith: input.sharedWith,
    contentWarnings: input.contentWarnings,
    analysisNotes: input.analysisNotes,
    riskProfile: input.riskProfile,
    scoreBreakdown: input.scoreBreakdown,
    releaseStart: input.releaseStart,
    releaseEnd: input.releaseEnd,
    watchDates: input.watchDates,
    country: undefined,
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
        runtimeMinutes: input.runtimeMinutes,
        pageCount: input.pageCount,
        episodeCount: input.episodeCount,
        chapterCount: input.chapterCount,
        metadata: details,
        updatedAt: now,
      })
      .where(eq(works.id, input.id))
      .run()

    tx.delete(workTitles)
      .where(
        and(
          eq(workTitles.workId, input.id),
          ne(workTitles.titleType, "canonical")
        )
      )
      .run()
    const canonical = tx
      .select()
      .from(workTitles)
      .where(
        and(
          eq(workTitles.workId, input.id),
          eq(workTitles.titleType, "canonical")
        )
      )
      .get()
    if (canonical) {
      tx.update(workTitles)
        .set({ title: input.title, isPreferred: true })
        .where(eq(workTitles.id, canonical.id))
        .run()
    } else {
      tx.insert(workTitles)
        .values({
          id: crypto.randomUUID(),
          workId: input.id,
          title: input.title,
          titleType: "canonical",
          isPreferred: true,
        })
        .run()
    }
    for (const alias of [
      ...new Set(input.aliases.map((item) => item.trim())),
    ]) {
      if (!alias || alias === input.title) continue
      tx.insert(workTitles)
        .values({
          id: crypto.randomUUID(),
          workId: input.id,
          title: alias,
          titleType: "alias",
        })
        .run()
    }

    const vocabularies = {
      genre: input.genres,
      tone: input.tone,
      tag: input.tags,
      audience: input.audience,
      country: input.country,
    }
    const oldTerms = tx
      .select({ id: terms.id })
      .from(terms)
      .where(inArray(terms.vocabulary, Object.keys(vocabularies)))
      .all()
    if (oldTerms.length) {
      tx.delete(workTerms)
        .where(
          and(
            eq(workTerms.workId, input.id),
            inArray(
              workTerms.termId,
              oldTerms.map(({ id }) => id)
            )
          )
        )
        .run()
    }
    for (const [vocabulary, values] of Object.entries(vocabularies)) {
      for (const name of [...new Set(values.map((item) => item.trim()))]) {
        if (!name) continue
        const termSlug = slug(name)
        let term = tx
          .select()
          .from(terms)
          .where(
            and(eq(terms.vocabulary, vocabulary), eq(terms.slug, termSlug))
          )
          .get()
        if (!term) {
          const id = crypto.randomUUID()
          tx.insert(terms)
            .values({ id, vocabulary, name, slug: termSlug })
            .run()
          term = tx.select().from(terms).where(eq(terms.id, id)).get()
        }
        if (term) {
          tx.insert(workTerms)
            .values({ workId: input.id, termId: term.id })
            .onConflictDoNothing()
            .run()
        }
      }
    }

    tx.delete(externalLinks)
      .where(
        and(
          eq(externalLinks.ownerType, "work"),
          eq(externalLinks.ownerId, input.id)
        )
      )
      .run()
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
        .run()
    }

    tx.delete(workCredits).where(eq(workCredits.workId, input.id)).run()
    for (const [position, credit] of input.credits.entries()) {
      const sortName = credit.name.trim().toLocaleLowerCase()
      const entityType =
        credit.role === "main-studio"
          ? "studio"
          : credit.role === "publisher"
            ? "publisher"
            : credit.entityType
      let entity = tx
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.entityType, entityType),
            eq(entities.sortName, sortName)
          )
        )
        .get()
      if (!entity) {
        const id = crypto.randomUUID()
        tx.insert(entities)
          .values({
            id,
            entityType,
            name: credit.name.trim(),
            sortName,
          })
          .run()
        entity = tx.select().from(entities).where(eq(entities.id, id)).get()
      }
      if (entity) {
        tx.insert(workCredits)
          .values({
            workId: input.id,
            entityId: entity.id,
            role: credit.role,
            position,
          })
          .onConflictDoNothing()
          .run()
      }
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
      tx.insert(workRelations)
        .values({
          id: crypto.randomUUID(),
          sourceWorkId:
            relation.direction === "outgoing" ? input.id : relation.workId,
          targetWorkId:
            relation.direction === "outgoing" ? relation.workId : input.id,
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
      .run()
  })

  const updated = listWorks().find((work) => work.id === input.id)
  if (!updated) throw new Error("Could not reload updated work")
  return updated
}

export function createWorksBulk(
  inputs: Array<
    CreateWork & {
      genres: Work["genres"]
      tags: string[]
      studios: string[]
    }
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
          metadata: { subtitle: "", palette: "new" },
          createdAt: now,
          updatedAt: now,
        })
        .run()
      tx.insert(workTitles)
        .values({
          id: crypto.randomUUID(),
          workId: id,
          title: input.title,
          titleType: "canonical",
          isPreferred: true,
        })
        .run()
      tx.insert(personalState)
        .values({ workId: id, status: "planned", updatedAt: now })
        .run()

      for (const [vocabulary, values] of Object.entries({
        genre: input.genres,
        tag: input.tags,
      })) {
        for (const name of [...new Set(values)]) {
          const termSlug = slug(name)
          let term = tx
            .select()
            .from(terms)
            .where(
              and(eq(terms.vocabulary, vocabulary), eq(terms.slug, termSlug))
            )
            .get()
          if (!term) {
            const termId = crypto.randomUUID()
            tx.insert(terms)
              .values({ id: termId, vocabulary, name, slug: termSlug })
              .run()
            term = tx.select().from(terms).where(eq(terms.id, termId)).get()
          }
          if (term) {
            tx.insert(workTerms)
              .values({ workId: id, termId: term.id })
              .onConflictDoNothing()
              .run()
          }
        }
      }

      for (const [position, studio] of input.studios.entries()) {
        const sortName = studio.trim().toLocaleLowerCase()
        if (!sortName) continue
        let entity = tx
          .select()
          .from(entities)
          .where(
            and(
              eq(entities.entityType, "studio"),
              eq(entities.sortName, sortName)
            )
          )
          .get()
        if (!entity) {
          const entityId = crypto.randomUUID()
          tx.insert(entities)
            .values({
              id: entityId,
              entityType: "studio",
              name: studio.trim(),
              sortName,
            })
            .run()
          entity = tx
            .select()
            .from(entities)
            .where(eq(entities.id, entityId))
            .get()
        }
        if (entity) {
          tx.insert(workCredits)
            .values({
              workId: id,
              entityId: entity.id,
              role: "main-studio",
              position,
            })
            .onConflictDoNothing()
            .run()
        }
      }
    }
  })
  return { created: ids.length, ids }
}

export function updateWorksBulk(input: {
  workIds: string[]
  kind?: WorkKind
  favorite?: boolean
  addGenres: Work["genres"]
  removeGenres: Work["genres"]
  addTags: string[]
  removeTags: string[]
}) {
  const now = Math.floor(Date.now() / 1000)
  db.transaction((tx) => {
    for (const workId of input.workIds) {
      if (input.kind) {
        tx.update(works)
          .set({ kind: input.kind, updatedAt: now })
          .where(eq(works.id, workId))
          .run()
      }

      for (const [vocabulary, additions, removals] of [
        ["genre", input.addGenres, input.removeGenres],
        ["tag", input.addTags, input.removeTags],
      ] as const) {
        for (const name of removals) {
          const term = tx
            .select()
            .from(terms)
            .where(
              and(eq(terms.vocabulary, vocabulary), eq(terms.slug, slug(name)))
            )
            .get()
          if (term) {
            tx.delete(workTerms)
              .where(
                and(eq(workTerms.workId, workId), eq(workTerms.termId, term.id))
              )
              .run()
          }
        }
        for (const name of additions) {
          let term = tx
            .select()
            .from(terms)
            .where(
              and(eq(terms.vocabulary, vocabulary), eq(terms.slug, slug(name)))
            )
            .get()
          if (!term) {
            const termId = crypto.randomUUID()
            tx.insert(terms)
              .values({
                id: termId,
                vocabulary,
                name,
                slug: slug(name),
              })
              .run()
            term = tx.select().from(terms).where(eq(terms.id, termId)).get()
          }
          if (term) {
            tx.insert(workTerms)
              .values({ workId, termId: term.id })
              .onConflictDoNothing()
              .run()
          }
        }
      }

      if (input.favorite !== undefined) {
        tx.insert(personalState)
          .values({ workId, favorite: input.favorite, updatedAt: now })
          .onConflictDoUpdate({
            target: personalState.workId,
            set: { favorite: input.favorite, updatedAt: now },
          })
          .run()
      }
    }
  })
  return { updated: input.workIds.length }
}

export function listSavedViews(): SavedUserView[] {
  return db
    .select()
    .from(savedViews)
    .orderBy(asc(savedViews.name))
    .all()
    .map((row) => {
      const filters = row.filterTree as Partial<
        Pick<
          SavedUserView,
          | "kinds"
          | "excludedKinds"
          | "statuses"
          | "excludedStatuses"
          | "minRating"
          | "favoriteOnly"
          | "yearFrom"
          | "yearTo"
          | "facets"
        >
      >
      const display = row.display as {
        gallery?: SavedUserView["gallery"]
      }
      return {
        id: row.id,
        name: row.name,
        layout: row.layout as SavedUserView["layout"],
        sort: row.sortField as SavedUserView["sort"],
        sortDirection: row.sortDirection as SavedUserView["sortDirection"],
        kinds: filters.kinds ?? [],
        excludedKinds: filters.excludedKinds ?? [],
        statuses: filters.statuses ?? [],
        excludedStatuses: filters.excludedStatuses ?? [],
        minRating: filters.minRating ?? 0,
        favoriteOnly: filters.favoriteOnly ?? false,
        yearFrom: filters.yearFrom ?? null,
        yearTo: filters.yearTo ?? null,
        cardSize: row.cardSize,
        gallery:
          display.gallery ??
          ({
            mode: "full",
            imageType: "poster",
            showType: true,
            showRating: true,
          } as const),
        facets: filters.facets,
        search: row.search,
        visibleColumns: row.visibleColumns,
        isPinned: row.isPinned,
      }
    })
}

export function createSavedView(
  input: Omit<SavedUserView, "id">
): SavedUserView {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  db.insert(savedViews)
    .values({
      id,
      name: input.name,
      layout: input.layout,
      filterTree: {
        kinds: input.kinds,
        excludedKinds: input.excludedKinds,
        statuses: input.statuses,
        excludedStatuses: input.excludedStatuses,
        minRating: input.minRating,
        favoriteOnly: input.favoriteOnly,
        yearFrom: input.yearFrom,
        yearTo: input.yearTo,
        facets: input.facets,
      },
      sortField: input.sort,
      sortDirection: input.sortDirection,
      visibleColumns: input.visibleColumns,
      cardSize: input.cardSize,
      search: input.search,
      display: { gallery: input.gallery },
      isPinned: input.isPinned,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  const created = listSavedViews().find((view) => view.id === id)
  if (!created) throw new Error("Could not create saved view")
  return created
}

export function deleteSavedView(id: string) {
  const result = db.delete(savedViews).where(eq(savedViews.id, id)).run()
  return { id, deleted: result.changes > 0 }
}

export function getWorkStructure(workId: string): WorkStructure {
  databaseWorkExists(workId)
  const seasonRows = db
    .select()
    .from(workSeasons)
    .where(eq(workSeasons.workId, workId))
    .orderBy(asc(workSeasons.position))
    .all()
  const unitRows = db
    .select()
    .from(workUnits)
    .where(eq(workUnits.workId, workId))
    .orderBy(asc(workUnits.position))
    .all()
  const personal = db
    .select()
    .from(personalState)
    .where(eq(personalState.workId, workId))
    .get()
  const unitsBySeason = new Map<string, typeof unitRows>()
  for (const unit of unitRows) {
    if (!unit.seasonId) continue
    const values = unitsBySeason.get(unit.seasonId) ?? []
    values.push(unit)
    unitsBySeason.set(unit.seasonId, values)
  }
  const orderedUnits = [
    ...seasonRows.flatMap((season) => unitsBySeason.get(season.id) ?? []),
    ...unitRows.filter((unit) => !unit.seasonId),
  ]
  const completedUnits = Math.min(
    Math.max(Math.trunc(personal?.progress ?? 0), 0),
    orderedUnits.length
  )
  const completedIds = new Set(
    orderedUnits.slice(0, completedUnits).map(({ id }) => id)
  )
  const completedAt = personal?.completedAt ?? null
  const updatedAt = personal?.updatedAt ?? 0
  const completedProgress = (id: string) => ({
    id: `tracking:${id}`,
    status: "completed" as const,
    progress: 1,
    completedAt,
    updatedAt,
  })
  const mapUnit = (
    unit: (typeof unitRows)[number]
  ): WorkStructure["ungroupedUnits"][number] => ({
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
  })

  return {
    workId,
    seasons: seasonRows.map((season) => {
      const units = (unitsBySeason.get(season.id) ?? []).map(mapUnit)
      const seasonCompleted =
        units.length > 0 && units.every((unit) => unit.progress !== null)
      const seasonProgress = units.filter(
        (unit) => unit.progress !== null
      ).length
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
          seasonProgress > 0
            ? {
                id: `tracking:${season.id}`,
                status: seasonCompleted ? "completed" : "in-progress",
                progress: seasonProgress,
                completedAt: seasonCompleted ? completedAt : null,
                updatedAt,
              }
            : null,
        units,
      }
    }),
    ungroupedUnits: unitRows.filter((unit) => !unit.seasonId).map(mapUnit),
    completedUnits,
    totalUnits: orderedUnits.length,
  }
}

export function getEditableWorkStructure(
  workId: string
): EditableWorkStructure {
  const structure = getWorkStructure(workId)
  const mapUnit = (unit: WorkStructure["ungroupedUnits"][number]) => ({
    id: unit.id,
    unitType: unit.unitType,
    title: unit.title,
    unitNumber: unit.unitNumber,
    position: unit.position,
    runtimeMinutes: unit.runtimeMinutes,
    pageCount: unit.pageCount,
    releaseAt: unit.releaseAt,
  })
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
  }
}

export function replaceWorkStructure(input: EditableWorkStructure) {
  databaseWorkExists(input.workId)
  const allSeasonPositions = input.seasons.map(({ position }) => position)
  if (new Set(allSeasonPositions).size !== allSeasonPositions.length) {
    throw new Error("Season positions must be unique within a work.")
  }
  const allSeasonTitles = input.seasons.map(({ title }) =>
    title.toLocaleLowerCase()
  )
  if (new Set(allSeasonTitles).size !== allSeasonTitles.length) {
    throw new Error("Season titles must be unique within a work.")
  }
  for (const season of input.seasons) {
    const positions = season.units.map(({ position }) => position)
    if (new Set(positions).size !== positions.length) {
      throw new Error(`Unit positions must be unique in ${season.title}.`)
    }
  }
  const ungroupedPositions = input.ungroupedUnits.map(
    ({ position }) => position
  )
  if (new Set(ungroupedPositions).size !== ungroupedPositions.length) {
    throw new Error("Ungrouped unit positions must be unique.")
  }

  const now = Math.floor(Date.now() / 1000)
  db.transaction((tx) => {
    const existingSeasons = tx
      .select()
      .from(workSeasons)
      .where(eq(workSeasons.workId, input.workId))
      .all()
    const existingUnits = tx
      .select()
      .from(workUnits)
      .where(eq(workUnits.workId, input.workId))
      .all()
    const requestedSeasonIds = new Set(
      input.seasons.flatMap(({ id }) => (id ? [id] : []))
    )
    const requestedUnitIds = new Set(
      [
        ...input.seasons.flatMap(({ units }) => units),
        ...input.ungroupedUnits,
      ].flatMap(({ id }) => (id ? [id] : []))
    )
    const removedSeasonIds = existingSeasons
      .filter(({ id }) => !requestedSeasonIds.has(id))
      .map(({ id }) => id)
    const removedUnitIds = existingUnits
      .filter(({ id }) => !requestedUnitIds.has(id))
      .map(({ id }) => id)

    for (const [index, season] of existingSeasons.entries()) {
      tx.update(workSeasons)
        .set({
          title: `__structure_edit_${season.id}`,
          position: 1_000_000 + index,
        })
        .where(eq(workSeasons.id, season.id))
        .run()
    }
    for (const [index, unit] of existingUnits.entries()) {
      tx.update(workUnits)
        .set({ position: 1_000_000 + index })
        .where(eq(workUnits.id, unit.id))
        .run()
    }
    if (removedUnitIds.length) {
      tx.delete(workUnits).where(inArray(workUnits.id, removedUnitIds)).run()
    }
    if (removedSeasonIds.length) {
      tx.delete(workSeasons)
        .where(inArray(workSeasons.id, removedSeasonIds))
        .run()
    }

    const seasonIds = new Map<string, string>()
    for (const season of input.seasons) {
      const id = season.id ?? crypto.randomUUID()
      const existing = existingSeasons.find((row) => row.id === id)
      if (season.id && !existing) {
        throw new Error(`Unknown season ID ${season.id}.`)
      }
      seasonIds.set(season.title, id)
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
          .run()
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
          .run()
      }
    }

    const saveUnit = (
      unit: EditableWorkStructure["ungroupedUnits"][number],
      seasonId: string | null
    ) => {
      const id = unit.id ?? crypto.randomUUID()
      const existing = existingUnits.find((row) => row.id === id)
      if (unit.id && !existing) throw new Error(`Unknown unit ID ${unit.id}.`)
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
      }
      if (existing) {
        tx.update(workUnits).set(values).where(eq(workUnits.id, id)).run()
      } else {
        tx.insert(workUnits)
          .values({ id, ...values, createdAt: now })
          .run()
      }
    }
    for (const season of input.seasons) {
      const seasonId = seasonIds.get(season.title)
      if (!seasonId) throw new Error(`Could not resolve ${season.title}.`)
      for (const unit of season.units) saveUnit(unit, seasonId)
    }
    for (const unit of input.ungroupedUnits) saveUnit(unit, null)
  })
  return getEditableWorkStructure(input.workId)
}

export function createWorkSeason(input: {
  workId: string
  title: string
  seasonNumber?: number | null
  position: number
  runtimeMinutes?: number | null
  unitCount?: number | null
  releaseAt?: number | null
}) {
  const id = crypto.randomUUID()
  databaseWorkExists(input.workId)
  db.insert(workSeasons)
    .values({ id, ...input })
    .run()
  const created = db
    .select()
    .from(workSeasons)
    .where(eq(workSeasons.id, id))
    .get()
  if (!created) throw new Error("Could not create season")
  return created
}

export function createWorkUnit(input: {
  workId: string
  seasonId?: string | null
  unitType: "episode" | "chapter" | "volume"
  title?: string | null
  unitNumber?: number | null
  position: number
  runtimeMinutes?: number | null
  pageCount?: number | null
  releaseAt?: number | null
}) {
  const id = crypto.randomUUID()
  databaseWorkExists(input.workId)
  db.insert(workUnits)
    .values({ id, ...input })
    .run()
  const created = db.select().from(workUnits).where(eq(workUnits.id, id)).get()
  if (!created) throw new Error("Could not create unit")
  return created
}

function databaseWorkExists(workId: string) {
  const work = db.select().from(works).where(eq(works.id, workId)).get()
  if (!work) throw new Error("Work not found")
}

function currentWorkMetric(workId: string) {
  const work = db.select().from(works).where(eq(works.id, workId)).get()
  if (!work) throw new Error("Work not found")
  const units = db
    .select({ unitType: workUnits.unitType })
    .from(workUnits)
    .where(eq(workUnits.workId, workId))
    .all()
  return deriveProgressMetric(
    work,
    units.length > 0
      ? { count: units.length, unitType: units[0].unitType }
      : undefined
  )
}

function completedAtForDate(occurredOn: string) {
  return Math.floor(Date.parse(`${occurredOn}T00:00:00.000Z`) / 1000)
}

function rebuildCurrentProjection(workId: string) {
  const latest = db
    .select()
    .from(trackingEntries)
    .where(eq(trackingEntries.workId, workId))
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence)
    )
    .limit(1)
    .get()
  const metric = currentWorkMetric(workId)
  const now = Math.floor(Date.now() / 1000)
  const status = latest?.status ?? "planned"
  db.insert(personalState)
    .values({
      workId,
      status,
      progress: latest?.progress ?? 0,
      progressTotal: metric.total,
      progressUnit: metric.unit,
      completedAt:
        status === "completed" && latest
          ? completedAtForDate(latest.occurredOn)
          : null,
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
          status === "completed" && latest
            ? completedAtForDate(latest.occurredOn)
            : null,
        updatedAt: now,
      },
    })
    .run()
}

function cleanTrackingEntry(
  row: typeof trackingEntries.$inferSelect
): TrackingEntry {
  return {
    id: row.id,
    workId: row.workId,
    progress: row.progress,
    status: row.status as TrackingEntry["status"],
    occurredOn: row.occurredOn,
    daySequence: row.daySequence,
    recordedAt: row.recordedAt,
  }
}

export function recordTrackingEntry(input: RecordTrackingEntry): TrackingEntry {
  const parsed = recordTrackingEntrySchema.parse(input)
  const metric = currentWorkMetric(parsed.workId)
  if (metric.total !== null && parsed.progress > metric.total) {
    throw new Error(
      `Progress cannot exceed the known total of ${metric.total}.`
    )
  }
  if (parsed.status === "planned" && parsed.progress !== 0) {
    throw new Error("Planned entries require zero progress.")
  }
  if (
    parsed.status === "completed" &&
    metric.total !== null &&
    parsed.progress !== metric.total
  ) {
    throw new Error("Completed entries must equal the known total.")
  }
  if (
    metric.total !== null &&
    parsed.progress === metric.total &&
    parsed.status !== "completed"
  ) {
    throw new Error("Reaching the known total requires completed status.")
  }

  const id = crypto.randomUUID()
  const recordedAt = Math.floor(Date.now() / 1000)
  db.transaction((tx) => {
    const latestOnDay = tx
      .select({ daySequence: trackingEntries.daySequence })
      .from(trackingEntries)
      .where(
        and(
          eq(trackingEntries.workId, parsed.workId),
          eq(trackingEntries.occurredOn, parsed.occurredOn)
        )
      )
      .orderBy(desc(trackingEntries.daySequence))
      .limit(1)
      .get()
    tx.insert(trackingEntries)
      .values({
        id,
        ...parsed,
        daySequence: (latestOnDay?.daySequence ?? -1) + 1,
        recordedAt,
      })
      .run()
  })
  rebuildCurrentProjection(parsed.workId)
  const created = db
    .select()
    .from(trackingEntries)
    .where(eq(trackingEntries.id, id))
    .get()
  if (!created) throw new Error("Could not record tracking entry.")
  return cleanTrackingEntry(created)
}

export function listWorkTrackingEntries(
  workId: string,
  limit = 200
): TrackingEntry[] {
  databaseWorkExists(workId)
  return db
    .select()
    .from(trackingEntries)
    .where(eq(trackingEntries.workId, workId))
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence)
    )
    .limit(Math.min(Math.max(limit, 1), 10_000))
    .all()
    .map(cleanTrackingEntry)
}

export function listTrackingPage(input: TrackingPageInput) {
  const conditions = []
  if (input.workId) conditions.push(eq(trackingEntries.workId, input.workId))
  if (input.statuses?.length) {
    conditions.push(inArray(trackingEntries.status, input.statuses))
  }
  if (input.dateFrom) {
    conditions.push(gte(trackingEntries.occurredOn, input.dateFrom))
  }
  if (input.dateTo) {
    conditions.push(lte(trackingEntries.occurredOn, input.dateTo))
  }
  if (input.cursor) {
    const cursor = input.cursor
    const cursorCondition = or(
      lt(trackingEntries.occurredOn, cursor.occurredOn),
      and(
        eq(trackingEntries.occurredOn, cursor.occurredOn),
        lt(trackingEntries.daySequence, cursor.daySequence)
      ),
      and(
        eq(trackingEntries.occurredOn, cursor.occurredOn),
        eq(trackingEntries.daySequence, cursor.daySequence),
        lt(trackingEntries.id, cursor.id)
      )
    )
    if (cursorCondition) conditions.push(cursorCondition)
  }
  const limit = Math.min(Math.max(input.limit, 1), 200)
  const rows = db
    .select()
    .from(trackingEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence),
      desc(trackingEntries.id)
    )
    .limit(limit + 1)
    .all()
  const items = rows.slice(0, limit).map(cleanTrackingEntry)
  const last = items.at(-1)
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
  }
}

export function removeTrackingEntry(entryId: string) {
  const entry = db
    .select()
    .from(trackingEntries)
    .where(eq(trackingEntries.id, entryId))
    .get()
  if (!entry) return { entryId, removed: false }
  db.delete(trackingEntries).where(eq(trackingEntries.id, entryId)).run()
  rebuildCurrentProjection(entry.workId)
  return { entryId, workId: entry.workId, removed: true }
}
