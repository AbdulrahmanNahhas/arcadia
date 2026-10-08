import assert from "node:assert/strict";

import { openDatabase, closeDatabase } from "@arcadia/cli/db";
import { workExport } from "@arcadia/cli/work";

import {
  loadWorkSnapshots,
  prepareWorkReview,
  commitWorkReview,
} from "../src/features/editor/work-edit.server";
const sql = openDatabase();
const [{ name }] = await sql`select current_database() as name`;
assert.equal(name, "nahhasio_dashboard_test", "Never run mutation checks on the live database.");
const ids = (await sql`select id from titles order by id limit 2`).map((row) => String(row.id));
const snapshots = await loadWorkSnapshots(ids);
const originals = snapshots.map((snapshot) => ({
  id: snapshot.document.id!,
  revision: snapshot.revision,
}));
const scope = (records: object[], fields: string[]) =>
  JSON.stringify({ schemaVersion: 1, fields, records });
const reviews = await prepareWorkReview(
  scope(
    snapshots.map(({ document }) => ({
      id: document.id,
      titleAr: "مراجعة تجريبية " + document.titleAr,
    })),
    ["titleAr"],
  ),
  originals,
);
assert.equal(reviews.records.length, 2);
assert.equal(reviews.records[0].changes.length, 1);
assert.deepEqual(
  await workExport(sql, ids[0]),
  snapshots[0].document,
  "Preparation must roll back",
);
await assert.rejects(commitWorkReview(reviews.ticket + "tampered"));
await sql`update titles set title_ar = 'تعديل متزامن' where id = ${ids[1]}`;
await assert.rejects(commitWorkReview(reviews.ticket), /تغيّر/);
assert.deepEqual(
  await workExport(sql, ids[0]),
  snapshots[0].document,
  "Stale second work must roll back first",
);
await sql`update titles set title_ar = ${snapshots[1].document.titleAr ?? null} where id = ${ids[1]}`;
assert.equal((await commitWorkReview(reviews.ticket)).saved, 2);
await assert.rejects(commitWorkReview(reviews.ticket), /تغيّر/);
for (const { document } of snapshots)
  await sql`update titles set title_ar = ${document.titleAr ?? null} where id = ${document.id!}`;
await assert.rejects(
  prepareWorkReview(
    scope(
      [{ id: ids[0], installments: [{ id: ids[1], title: "foreign", kind: "season" }] }],
      ["installments"],
    ),
    originals,
  ),
  /معرّف/,
);
await assert.rejects(
  prepareWorkReview(
    scope([{ id: ids[0], media: { posterr: "/media/x.jpg" } }], ["media"]),
    originals,
  ),
  /غير معروف|Unknown media role/,
);
const zero = await prepareWorkReview(
  scope([{ id: ids[0], titleAr: snapshots[0].document.titleAr }], ["titleAr"]),
  originals,
);
assert.equal(zero.records.length, 0);
const structure = await prepareWorkReview(
  scope(
    [
      {
        id: ids[0],
        installments: [
          ...snapshots[0].document.installments!,
          {
            kind: "season",
            position: 999,
            title: "review-only test part",
            episodes: [{ number: 1, position: 1, title: "test episode" }],
          },
        ],
      },
    ],
    ["installments"],
  ),
  originals,
);
assert.equal(structure.records.length, 1);
assert.deepEqual(await workExport(sql, ids[0]), snapshots[0].document);
await commitWorkReview(structure.ticket);
const after = await workExport(sql, ids[0]);
assert.equal(after.installments!.length, snapshots[0].document.installments!.length + 1);
const created = after.installments!.find((item) => item.title === "review-only test part")!;
await sql`delete from episodes where installment_id = ${created.id!}`;
await sql`delete from installments where id = ${created.id!}`;
assert.deepEqual(await workExport(sql, ids[0]), snapshots[0].document);
console.log(
  "PASS: real rolled-back diffs, signed review, stale/replay rejection, atomic bulk saves, unknown/foreign field rejection, stable new part/episode IDs, no-op reviews. Disposable database only.",
);
await closeDatabase();
