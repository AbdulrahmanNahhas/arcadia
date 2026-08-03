import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as AgentAccess from "./agent-access";
import type * as Repository from "./repository";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "arcadia-agent-access-test-"));
process.env.ARCADIA_DB_PATH = join(temporaryDirectory, "arcadia.db");

let access: typeof AgentAccess;
let repository: typeof Repository;

beforeAll(async () => {
  [access, repository] = await Promise.all([import("./agent-access"), import("./repository")]);
  const favorite = repository.createWork({
    title: "Agent Favorite",
    kind: "anime",
    year: 2024,
    status: "planned",
    summary: "A searchable catalog record",
  });
  repository.updateFavorite(favorite.id, true);
  repository.createWork({
    title: "Agent Novel",
    kind: "novel",
    year: 1999,
    status: "completed",
    summary: "Another record",
  });
});

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("agent database access", () => {
  it("filters and paginates normalized works", () => {
    expect(
      access.queryWorks({ search: "searchable", kinds: ["anime"], favorite: true }),
    ).toMatchObject({
      total: 1,
      offset: 0,
      works: [{ title: "Agent Favorite", kind: "anime", favorite: true }],
    });
  });

  it("discovers schema and safely filters raw table rows", () => {
    expect(access.getDatabaseSchema("works").works.map(({ name }) => name)).toContain(
      "canonical_title",
    );
    expect(
      access.listTableRows("works", {
        where: [{ column: "kind", value: "novel" }],
        order: "canonical_title",
      }),
    ).toMatchObject({
      total: 1,
      rows: [{ canonical_title: "Agent Novel", kind: "novel" }],
    });
    expect(() =>
      access.listTableRows("works", { where: [{ column: "not_a_column", value: "x" }] }),
    ).toThrow("Unknown column");
  });
});
