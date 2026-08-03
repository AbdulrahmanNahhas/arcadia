import type { Work } from "@/features/library/model";
import { sqlite } from "./client";
import { getWorkStructure, listWorks, listWorkTrackingEntries } from "./repository";

const MAX_PAGE_SIZE = 1_000;

type SqliteColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: unknown;
  pk: 0 | 1;
};

export type WorkQuery = {
  search?: string;
  kinds?: string[];
  statuses?: string[];
  releaseStatuses?: string[];
  genres?: string[];
  tags?: string[];
  tones?: string[];
  contributors?: string[];
  countries?: string[];
  audiences?: string[];
  providers?: string[];
  favorite?: boolean;
  yearFrom?: number;
  yearTo?: number;
  limit?: number;
  offset?: number;
};

export type TableQuery = {
  where?: Array<{ column: string; value: string | null }>;
  order?: string;
  descending?: boolean;
  limit?: number;
  offset?: number;
};

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function pageSize(value: number | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new Error(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }
  return value;
}

function pageOffset(value: number | undefined) {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("offset must be a non-negative integer");
  }
  return value;
}

function databaseTableNames() {
  return (
    sqlite
      .prepare(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
      )
      .all() as Array<{ name: string }>
  ).map(({ name }) => name);
}

function assertTable(table: string) {
  if (!databaseTableNames().includes(table)) throw new Error(`Unknown table: ${table}`);
}

export function getDatabaseSchema(table?: string) {
  const names = table ? [table] : databaseTableNames();
  if (table) assertTable(table);
  return Object.fromEntries(
    names.map((name) => [
      name,
      sqlite.prepare(`pragma table_info(${quoteIdentifier(name)})`).all() as SqliteColumn[],
    ]),
  );
}

export function listDatabaseTables() {
  return databaseTableNames().map((name) => ({
    name,
    rows: (
      sqlite.prepare(`select count(*) as count from ${quoteIdentifier(name)}`).get() as {
        count: number;
      }
    ).count,
  }));
}

export function listTableRows(table: string, query: TableQuery = {}) {
  assertTable(table);
  const columns = (getDatabaseSchema(table)[table] ?? []).map(({ name }) => name);
  const filters = query.where ?? [];
  for (const filter of filters) {
    if (!columns.includes(filter.column)) {
      throw new Error(`Unknown column ${filter.column} on table ${table}`);
    }
  }
  if (query.order && !columns.includes(query.order)) {
    throw new Error(`Unknown order column ${query.order} on table ${table}`);
  }

  const limit = pageSize(query.limit, 100);
  const offset = pageOffset(query.offset);
  const whereSql = filters.length
    ? ` where ${filters
        .map(
          ({ column, value }) => `${quoteIdentifier(column)} ${value === null ? "is null" : "= ?"}`,
        )
        .join(" and ")}`
    : "";
  const orderSql = query.order
    ? ` order by ${quoteIdentifier(query.order)}${query.descending ? " desc" : " asc"}`
    : "";
  const values = filters.flatMap(({ value }) => (value === null ? [] : [value]));
  const total = (
    sqlite
      .prepare(`select count(*) as count from ${quoteIdentifier(table)}${whereSql}`)
      .get(...values) as { count: number }
  ).count;
  const rows = sqlite
    .prepare(`select * from ${quoteIdentifier(table)}${whereSql}${orderSql} limit ? offset ?`)
    .all(...values, limit, offset);

  return { table, columns, total, limit, offset, rows };
}

function includesOne(values: string[], filters: string[] | undefined) {
  if (!filters?.length) return true;
  const normalized = values.map((value) => value.toLocaleLowerCase());
  return filters.some((filter) => normalized.includes(filter.toLocaleLowerCase()));
}

function workSearchText(work: Work) {
  return [
    work.id,
    work.title,
    work.arabicTitle ?? "",
    work.creator,
    work.summary,
    ...work.aliases,
    ...work.genres,
    ...work.tags,
    ...work.tone,
    ...work.studios,
    ...work.contributors.map(({ name }) => name),
  ]
    .join(" ")
    .toLocaleLowerCase();
}

export function queryWorks(query: WorkQuery = {}) {
  const search = query.search?.trim().toLocaleLowerCase();
  const filtered = listWorks().filter((work) => {
    if (search && !workSearchText(work).includes(search)) return false;
    if (!includesOne([work.kind], query.kinds)) return false;
    if (!includesOne([work.status], query.statuses)) return false;
    if (!includesOne([work.releaseStatus], query.releaseStatuses)) return false;
    if (!includesOne(work.genres, query.genres)) return false;
    if (!includesOne(work.tags, query.tags)) return false;
    if (!includesOne(work.tone, query.tones)) return false;
    if (
      !includesOne(
        work.contributors.map(({ name }) => name),
        query.contributors,
      )
    )
      return false;
    if (!includesOne(work.country, query.countries)) return false;
    if (!includesOne(work.audience ? [work.audience] : [], query.audiences)) return false;
    if (
      !includesOne(
        work.externalLinks.map(({ provider }) => provider),
        query.providers,
      )
    )
      return false;
    if (query.favorite !== undefined && work.favorite !== query.favorite) return false;
    if (query.yearFrom !== undefined && (work.year === null || work.year < query.yearFrom))
      return false;
    if (query.yearTo !== undefined && (work.year === null || work.year > query.yearTo))
      return false;
    return true;
  });
  const limit = pageSize(query.limit, MAX_PAGE_SIZE);
  const offset = pageOffset(query.offset);
  return {
    total: filtered.length,
    limit,
    offset,
    works: filtered.slice(offset, offset + limit),
  };
}

function relatedRecords(table: string, where: TableQuery["where"]) {
  return listTableRows(table, { where, limit: MAX_PAGE_SIZE }).rows;
}

export function getAgentWorkDetails(workId: string, trackingLimit = 200) {
  const work = listWorks().find(({ id }) => id === workId);
  if (!work) throw new Error(`Work not found: ${workId}`);
  const records = {
    works: relatedRecords("works", [{ column: "id", value: workId }]),
    work_titles: relatedRecords("work_titles", [{ column: "work_id", value: workId }]),
    work_contributions: relatedRecords("work_contributions", [
      { column: "work_id", value: workId },
    ]),
    work_terms: relatedRecords("work_terms", [{ column: "work_id", value: workId }]),
    work_relations: [
      ...relatedRecords("work_relations", [{ column: "source_work_id", value: workId }]),
      ...relatedRecords("work_relations", [{ column: "target_work_id", value: workId }]),
    ],
    personal_state: relatedRecords("personal_state", [{ column: "work_id", value: workId }]),
    personal_scores: relatedRecords("personal_scores", [{ column: "work_id", value: workId }]),
    work_seasons: relatedRecords("work_seasons", [{ column: "work_id", value: workId }]),
    work_units: relatedRecords("work_units", [{ column: "work_id", value: workId }]),
    tracking_entries: relatedRecords("tracking_entries", [{ column: "work_id", value: workId }]),
    assets: relatedRecords("assets", [
      { column: "owner_type", value: "work" },
      { column: "owner_id", value: workId },
    ]),
    external_links: relatedRecords("external_links", [
      { column: "owner_type", value: "work" },
      { column: "owner_id", value: workId },
    ]),
    similarity_artifacts: relatedRecords("similarity_artifacts", [
      { column: "work_id", value: workId },
    ]),
  };
  return {
    work,
    structure: getWorkStructure(workId),
    trackingEntries: listWorkTrackingEntries(workId, pageSize(trackingLimit, 200)),
    records,
  };
}
