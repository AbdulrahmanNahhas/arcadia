import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminEntityInputSchema,
  adminWorkUpdateSchema,
  createWorkSchema,
} from "@/features/library/model";
import type { db as databaseValue } from "./client";
import type * as Repository from "./repository";
import type * as Schema from "./schema";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "arcadia-db-test-"));
process.env.ARCADIA_DB_PATH = join(temporaryDirectory, "arcadia.db");

let repository: typeof Repository;
let database: typeof databaseValue;
let schema: typeof Schema;

beforeAll(async () => {
  [{ db: database }, schema, repository] = await Promise.all([
    import("./client"),
    import("./schema"),
    import("./repository"),
  ]);
});

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

function createTrackedWork(title: string, total = 10) {
  const work = repository.createWork({
    title,
    kind: "series",
    year: 2026,
    status: "planned",
    summary: "",
  });
  database
    .update(schema.works)
    .set({ episodeCount: total })
    .where(eq(schema.works.id, work.id))
    .run();
  return work;
}

function currentWork(workId: string) {
  const work = repository.listWorks().find(({ id }) => id === workId);
  if (!work) throw new Error("Work not found in projection");
  return work;
}

describe("admin record persistence", () => {
  it("creates and updates complete unlinked entity profiles", () => {
    const created = repository.saveEntity(
      adminEntityInputSchema.parse({
        name: "Example Studio",
        sortName: "example studio",
        entityType: "organization",
        description: "Independent animation studio.",
        imagePath: "/media/entities/example.webp",
        malId: 42,
        sourceUrl: "https://example.com/studio",
        sourceProvider: "Example",
        establishedAt: "2020",
        favorites: 12,
        alternativeNames: ["Example Animation", "Example Animation"],
        externalIdentities: [
          { provider: "AniList", externalId: "42", url: "https://example.com/42" },
        ],
      }),
    );

    expect(created).toMatchObject({
      workCount: 0,
      alternativeNames: ["Example Animation"],
      imagePath: "/media/entities/example.webp",
      externalIdentities: [{ provider: "AniList", externalId: "42" }],
    });
    expect(repository.listEntities().some(({ id }) => id === created.id)).toBe(true);

    const updated = repository.saveEntity({
      ...created,
      description: "Updated profile.",
      imagePath: null,
      externalIdentities: [],
    });
    expect(updated).toMatchObject({
      id: created.id,
      description: "Updated profile.",
      imagePath: null,
      externalIdentities: [],
    });
  });

  it("calculates a rating from persisted components without changing tracking", () => {
    const work = createTrackedWork("Rated Work");
    repository.recordTrackingEntry({
      workId: work.id,
      progress: 3,
      status: "in-progress",
      occurredOn: "2026-07-01",
    });
    const current = currentWork(work.id);
    const {
      addedAt: _addedAt,
      catalogUpdatedAt: _catalogUpdatedAt,
      personalUpdatedAt: _personalUpdatedAt,
      palette: _palette,
      relations,
      ...editable
    } = current;

    repository.updateWork(
      adminWorkUpdateSchema.parse({
        ...editable,
        scoreComponents: {
          story: 8,
          characters: 9,
          depth: 7,
          worldBuilding: 8,
          originality: 6,
          craft: 9,
        },
        relations: relations.map(({ id, workId, relationType, direction, notes, provenance }) => ({
          id,
          workId,
          relationType,
          direction,
          notes,
          provenance,
        })),
      }),
    );

    expect(currentWork(work.id)).toMatchObject({
      calculatedRating: 8.1,
      scoreComponents: {
        story: 8,
        characters: 9,
        depth: 7,
        worldBuilding: 8,
        originality: 6,
        craft: 9,
      },
      progress: 3,
      status: "in-progress",
    });
  });
});

describe("canonical work relationships", () => {
  it("presents inverse directions, derives sequel movies, and preserves stable IDs on edit", () => {
    const predecessor = repository.createWork({
      title: "Relationship Parent",
      kind: "series",
      year: 2020,
      status: "planned",
      summary: "",
    });
    const continuation = repository.createWork({
      title: "Relationship Movie",
      kind: "movie",
      year: 2022,
      status: "planned",
      summary: "",
    });
    const relationId = crypto.randomUUID();
    database
      .insert(schema.workRelations)
      .values({
        id: relationId,
        sourceWorkId: predecessor.id,
        targetWorkId: continuation.id,
        relationType: "sequel",
        provenance: "provider:test",
        externalKey: "provider:relation:1",
      })
      .run();

    expect(currentWork(predecessor.id).relations[0]).toMatchObject({
      id: relationId,
      direction: "outgoing",
      provenance: "provider:test",
    });
    expect(currentWork(continuation.id)).toMatchObject({
      isSequelMovie: true,
      relations: [{ id: relationId, direction: "incoming" }],
    });

    const current = currentWork(predecessor.id);
    repository.updateWork(
      adminWorkUpdateSchema.parse({
        ...current,
        relations: current.relations.map(
          ({ id, workId, relationType, direction, provenance, externalKey }) => ({
            id,
            workId,
            relationType,
            direction,
            provenance,
            externalKey,
            notes: "Stable edit",
          }),
        ),
      }),
    );
    expect(
      database
        .select()
        .from(schema.workRelations)
        .where(eq(schema.workRelations.id, relationId))
        .get(),
    ).toMatchObject({
      id: relationId,
      notes: "Stable edit",
      provenance: "provider:test",
      externalKey: "provider:relation:1",
    });
  });

  it("rejects self edges, noncanonical undirected order, and duplicate canonical edges", () => {
    const left = createTrackedWork("Relation Left");
    const right = createTrackedWork("Relation Right");
    expect(() =>
      database
        .insert(schema.workRelations)
        .values({
          id: crypto.randomUUID(),
          sourceWorkId: left.id,
          targetWorkId: left.id,
          relationType: "related",
          isDirected: false,
        })
        .run(),
    ).toThrow();
    const [sourceWorkId, targetWorkId] = [left.id, right.id].sort();
    database
      .insert(schema.workRelations)
      .values({
        id: crypto.randomUUID(),
        sourceWorkId,
        targetWorkId,
        relationType: "related",
        isDirected: false,
      })
      .run();
    expect(() =>
      database
        .insert(schema.workRelations)
        .values({
          id: crypto.randomUUID(),
          sourceWorkId,
          targetWorkId,
          relationType: "related",
          isDirected: false,
        })
        .run(),
    ).toThrow();
    expect(() =>
      database
        .insert(schema.workRelations)
        .values({
          id: crypto.randomUUID(),
          sourceWorkId: targetWorkId,
          targetWorkId: sourceWorkId,
          relationType: "related",
          isDirected: false,
        })
        .run(),
    ).toThrow();
  });
});

describe("tracking core", () => {
  it("defaults new works to saved and preserves that baseline in activity history", () => {
    const work = repository.createWork(
      createWorkSchema.parse({ title: "Saved by Default", kind: "series", year: 2026 }),
    );
    expect(work.status).toBe("saved");
    const entry = repository.recordTrackingEntry({
      workId: work.id,
      progress: 0,
      status: "in-progress",
      occurredOn: "2026-08-01",
    });
    expect(entry.statusBefore).toBe("saved");
    repository.removeTrackingEntry(entry.id);
    expect(currentWork(work.id).status).toBe("saved");
  });

  it("stores exact progress ranges and repairs later ranges after backdating", () => {
    const work = createTrackedWork("Continuous Work");
    const first = repository.recordTrackingEntry({
      workId: work.id,
      progress: 1,
      status: "in-progress",
      occurredOn: "2026-04-01",
    });
    const latest = repository.recordTrackingEntry({
      workId: work.id,
      progress: 5,
      status: "paused",
      occurredOn: "2026-04-03",
    });

    expect(first).toMatchObject({
      progressBefore: 0,
      progress: 1,
      statusBefore: "planned",
      status: "in-progress",
    });
    expect(latest).toMatchObject({
      progressBefore: 1,
      progress: 5,
      statusBefore: "in-progress",
      status: "paused",
    });

    const backdated = repository.recordTrackingEntry({
      workId: work.id,
      progress: 3,
      status: "in-progress",
      occurredOn: "2026-04-02",
    });
    expect(backdated).toMatchObject({
      progressBefore: 1,
      progress: 3,
    });
    expect(repository.listWorkTrackingEntries(work.id)).toMatchObject([
      { id: latest.id, progressBefore: 3, progress: 5 },
      { id: backdated.id, progressBefore: 1, progress: 3 },
      { id: first.id, progressBefore: 0, progress: 1 },
    ]);

    repository.removeTrackingEntry(backdated.id);
    expect(repository.listWorkTrackingEntries(work.id)).toMatchObject([
      { id: latest.id, progressBefore: 1, progress: 5 },
      { id: first.id, progressBefore: 0, progress: 1 },
    ]);
  });

  it("orders backdated entries chronologically without overwriting newer state", () => {
    const work = createTrackedWork("Backdated Work");
    repository.recordTrackingEntry({
      workId: work.id,
      progress: 6,
      status: "in-progress",
      occurredOn: "2026-06-10",
    });
    repository.recordTrackingEntry({
      workId: work.id,
      progress: 2,
      status: "in-progress",
      occurredOn: "2026-01-03",
    });

    expect(currentWork(work.id)).toMatchObject({
      progress: 6,
      status: "in-progress",
      progressTotal: 10,
      progressUnit: "episodes",
    });
    expect(repository.listWorkTrackingEntries(work.id).map(({ occurredOn }) => occurredOn)).toEqual(
      ["2026-06-10", "2026-01-03"],
    );
  });

  it("assigns deterministic same-day sequence and rewinds after removal", () => {
    const work = createTrackedWork("Same Day Work");
    const first = repository.recordTrackingEntry({
      workId: work.id,
      progress: 2,
      status: "in-progress",
      occurredOn: "2026-03-15",
    });
    const second = repository.recordTrackingEntry({
      workId: work.id,
      progress: 4,
      status: "paused",
      occurredOn: "2026-03-15",
    });

    expect(first.daySequence).toBe(0);
    expect(second.daySequence).toBe(1);
    expect(currentWork(work.id)).toMatchObject({
      progress: 4,
      status: "paused",
    });

    expect(repository.removeTrackingEntry(second.id)).toMatchObject({
      removed: true,
      workId: work.id,
    });
    expect(currentWork(work.id)).toMatchObject({
      progress: 2,
      status: "in-progress",
    });

    repository.removeTrackingEntry(first.id);
    expect(currentWork(work.id)).toMatchObject({
      progress: 0,
      status: "planned",
    });
  });

  it("keeps date-only values stable and maps completion to UTC midnight", () => {
    const work = createTrackedWork("Date Stable Work", 3);
    const entry = repository.recordTrackingEntry({
      workId: work.id,
      progress: 3,
      status: "completed",
      occurredOn: "2024-02-29",
    });

    expect(entry.occurredOn).toBe("2024-02-29");
    expect(repository.listTrackingPage({ limit: 10, workId: work.id }).items[0]).toEqual(entry);
    expect(currentWork(work.id).completedAt).toBe(
      Math.floor(Date.parse("2024-02-29T00:00:00.000Z") / 1000),
    );
  });

  it("enforces integer bounds and status invariants", () => {
    const work = createTrackedWork("Invariant Work", 5);
    const record = (progress: number, status: "planned" | "in-progress" | "completed") =>
      repository.recordTrackingEntry({
        workId: work.id,
        progress,
        status,
        occurredOn: "2026-04-20",
      });

    expect(() => record(-1, "in-progress")).toThrow();
    expect(() => record(1.5, "in-progress")).toThrow();
    expect(() => record(6, "in-progress")).toThrow(/known total/);
    expect(() => record(1, "planned")).toThrow(/zero progress/);
    expect(() => record(4, "completed")).toThrow(/known total/);
    expect(() => record(5, "in-progress")).toThrow(/requires completed/);
    expect(() =>
      repository.recordTrackingEntry({
        workId: work.id,
        progress: 0,
        status: "planned",
        occurredOn: "2026-02-30",
      }),
    ).toThrow();
    expect(record(5, "completed")).toMatchObject({
      progress: 5,
      status: "completed",
    });
  });

  it("derives unit and season completion from the projected ordered prefix", () => {
    const work = createTrackedWork("Structured Work", 99);
    const seasonOne = repository.createWorkSeason({
      workId: work.id,
      title: "Season One",
      seasonNumber: 1,
      position: 0,
    });
    const seasonTwo = repository.createWorkSeason({
      workId: work.id,
      title: "Season Two",
      seasonNumber: 2,
      position: 1,
    });
    const first = repository.createWorkUnit({
      workId: work.id,
      seasonId: seasonOne.id,
      unitType: "episode",
      title: "One",
      unitNumber: 1,
      position: 0,
    });
    const second = repository.createWorkUnit({
      workId: work.id,
      seasonId: seasonOne.id,
      unitType: "episode",
      title: "Two",
      unitNumber: 2,
      position: 1,
    });
    const third = repository.createWorkUnit({
      workId: work.id,
      seasonId: seasonTwo.id,
      unitType: "episode",
      title: "Three",
      unitNumber: 1,
      position: 0,
    });

    repository.recordTrackingEntry({
      workId: work.id,
      progress: 2,
      status: "in-progress",
      occurredOn: "2026-05-01",
    });
    const structure = repository.getWorkStructure(work.id);

    expect(structure).toMatchObject({
      completedUnits: 2,
      totalUnits: 3,
      seasons: [
        {
          id: seasonOne.id,
          progress: { status: "completed", progress: 2 },
          units: [
            { id: first.id, progress: { status: "completed" } },
            { id: second.id, progress: { status: "completed" } },
          ],
        },
        {
          id: seasonTwo.id,
          progress: null,
          units: [{ id: third.id, progress: null }],
        },
      ],
    });
    expect(currentWork(work.id)).toMatchObject({
      progress: 2,
      progressTotal: 3,
      progressUnit: "episodes",
    });
  });

  it("projects progress through season unit counts without episode rows", () => {
    const work = createTrackedWork("Season Count Work", 38);
    const seasonOne = repository.createWorkSeason({
      workId: work.id,
      title: "Season One",
      seasonNumber: 1,
      position: 0,
      unitCount: 28,
    });
    const seasonTwo = repository.createWorkSeason({
      workId: work.id,
      title: "Season Two",
      seasonNumber: 2,
      position: 1,
      unitCount: 10,
    });

    repository.recordTrackingEntry({
      workId: work.id,
      progress: 30,
      status: "in-progress",
      occurredOn: "2026-06-01",
    });

    expect(repository.getWorkStructure(work.id)).toMatchObject({
      completedUnits: 30,
      totalUnits: 38,
      seasons: [
        {
          id: seasonOne.id,
          progress: { status: "completed", progress: 28 },
        },
        {
          id: seasonTwo.id,
          progress: { status: "in-progress", progress: 2 },
        },
      ],
    });
  });

  it("tracks movies by status without using runtime minutes", () => {
    const movie = repository.createWork({
      title: "Status Only Movie",
      kind: "movie",
      year: 2026,
      status: "planned",
      summary: "",
    });

    const entry = repository.recordTrackingEntry({
      workId: movie.id,
      progress: 0,
      status: "completed",
      occurredOn: "2026-07-01",
    });

    expect(entry).toMatchObject({
      progressBefore: 0,
      progress: 0,
      statusBefore: "planned",
      status: "completed",
    });
    expect(currentWork(movie.id)).toMatchObject({
      progress: 0,
      progressTotal: null,
      progressUnit: "movie",
      status: "completed",
    });
    expect(() =>
      repository.recordTrackingEntry({
        workId: movie.id,
        progress: 90,
        status: "completed",
        occurredOn: "2026-07-02",
      }),
    ).toThrow(/status-only/);
  });
});

describe("saved view destinations", () => {
  it("persists identity metadata and updates promotion settings", () => {
    const created = repository.createSavedView({
      name: "قيد المتابعة",
      description: "الأعمال التي أتابعها الآن",
      icon: "clock",
      color: "blue",
      layout: "gallery",
      sort: "recent",
      sortDirection: "desc",
      kinds: [],
      excludedKinds: [],
      statuses: ["in-progress"],
      excludedStatuses: [],
      showSaved: false,
      showAnnounced: false,
      showSequelMovies: false,
      minRating: 0,
      minScores: {},
      favoriteOnly: false,
      yearFrom: null,
      yearTo: null,
      cardSize: 154,
      gallery: {
        mode: "full",
        imageType: "poster",
        showType: true,
        showRating: true,
        showTitle: true,
        showFavorite: true,
        showCreator: false,
        showYear: true,
        showGenres: true,
        showProgress: false,
      },
      tableDensity: "comfortable",
      search: "",
      visibleColumns: ["artwork", "title", "status"],
      isPinned: false,
    });

    const updated = repository.updateSavedView({
      id: created.id,
      name: "أتابعها الآن",
      description: "وجهة رئيسية للمتابعة",
      icon: "lightning",
      color: "amber",
      layout: "table",
      sort: "title",
      sortDirection: "asc",
      isPinned: true,
    });

    expect(updated).toMatchObject({
      name: "أتابعها الآن",
      description: "وجهة رئيسية للمتابعة",
      icon: "lightning",
      color: "amber",
      layout: "table",
      sort: "title",
      sortDirection: "asc",
      isPinned: true,
      statuses: ["in-progress"],
    });
    expect(repository.listSavedViews()[0]?.id).toBe(created.id);
    expect(repository.deleteSavedView(created.id)).toEqual({
      id: created.id,
      deleted: true,
    });
  });
});
