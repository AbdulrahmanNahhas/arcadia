import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const connection = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1 }) : null;
const integration = connection ? describe : describe.skip;

integration("PostgreSQL v2 constraints", () => {
  it("has all catalog, profile, and media tables", async () => {
    if (!connection) throw new Error("DATABASE_URL is required");
    const rows = await connection`select tablename from pg_tables where schemaname='public'`;
    const names = new Set(rows.map((row) => row.tablename));
    for (const name of [
      "titles",
      "installments",
      "episodes",
      "viewer_profiles",
      "profile_admin_restrictions",
      "media_files",
      "media_tracks",
      "jellyfin_items",
    ])
      expect(names.has(name)).toBe(true);
  });

  it("enforces one profile per account and one media owner", async () => {
    if (!connection) throw new Error("DATABASE_URL is required");
    const [constraint] =
      await connection`select conname from pg_constraint where conname='media_file_single_owner_check'`;
    const [profileIndex] =
      await connection`select indexname from pg_indexes where indexname='viewer_profiles_account_uq'`;
    expect(constraint?.conname).toBe("media_file_single_owner_check");
    expect(profileIndex?.indexname).toBe("viewer_profiles_account_uq");
  });
});

afterAll(async () => connection?.end());
