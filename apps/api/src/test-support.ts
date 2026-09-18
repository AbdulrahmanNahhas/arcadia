import { database } from "./database";

/**
 * Whether the test database holds a real catalog. `pnpm db:seed` creates accounts and
 * vocabularies but no titles — the family catalog comes from `db:import` of the v1 SQLite
 * source, which CI does not have. Tests that assert over catalog *content* (sort orders, a known
 * studio, admin metrics) call this once and `it.skipIf` themselves, so an empty catalog reads as
 * "skipped: needs the imported catalog" rather than as a red build.
 */
export async function catalogIsPopulated(): Promise<boolean> {
  // Well above what any scratch-title test leaves behind, well below the smallest real catalog.
  const [row] = await database().client`select count(*)::int as count from titles`;
  return Number(row?.count ?? 0) > 20;
}

/**
 * A throwaway movie for tests that only need *some* playable unit to exist (downloads,
 * playback state). Returns the ids; `remove()` deletes the title, cascading everything under it.
 */
export async function createScratchMovie(label: string) {
  const sql = database().client;
  const [title] = await sql`
    insert into titles (canonical_title, sort_title, title_ar, is_private)
    values (${`Test ${label}`}, ${`test ${label}`.toLowerCase()}, ${`اختبار ${label}`}, false)
    returning id`;
  if (!title) throw new Error("could not create the scratch title");
  const titleId = String(title.id);
  const [installment] = await sql`
    insert into installments (title_id, kind, position, title)
    values (${titleId}, 'movie', 1, ${`Test ${label}`})
    returning id`;
  if (!installment) throw new Error("could not create the scratch installment");
  return {
    titleId,
    installmentId: String(installment.id),
    remove: async () => {
      await sql`delete from titles where id=${titleId}`;
    },
  };
}
