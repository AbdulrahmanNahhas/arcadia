import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { closeDatabase, openDatabase } from "@arcadia/cli/db";
import type { WorkDocument } from "@arcadia/cli/work";
import { workExport } from "@arcadia/cli/work";

import {
  commitWorkReview,
  inspectEpisodeDeletion,
  loadWorkSnapshots,
  prepareWorkReview,
} from "../src/features/editor/work-edit.server";

const sql = openDatabase();
const [{ name }] = await sql`select current_database() as name`;
assert.equal(
  name,
  "nahhasio_dashboard_test",
  "Mutation checks require the disposable restored catalog.",
);
const workId = randomUUID();
const partId = randomUUID();
const episodeId = randomUUID();
const orgId = randomUUID();
const categoryId = randomUUID();
const ceremonyId = randomUUID();
const slug = `review-test-${orgId}`;
async function prepare(patch: Partial<WorkDocument>, fields: string[]) {
  const [snapshot] = await loadWorkSnapshots([workId]);
  return prepareWorkReview(
    JSON.stringify({ schemaVersion: 1, fields, records: [{ id: workId, ...patch }] }),
    [{ id: workId, revision: snapshot.revision }],
  );
}
try {
  await sql`insert into titles(id, canonical_title, sort_title) values(${workId}, 'Disposable editor checks', 'disposable editor checks')`;
  await sql`insert into installments(id, title_id, kind, title, position) values(${partId}, ${workId}, 'season', 'Season', 1)`;
  await sql`insert into episodes(id, installment_id, number, position) values(${episodeId}, ${partId}, 1, 1)`;
  await sql`insert into award_organizations(id, slug, name_ar) values(${orgId}, ${slug}, 'جهة تجريبية')`;
  await sql`insert into award_categories(id, organization_id, slug, name_ar) values(${categoryId}, ${orgId}, 'test-category', 'فئة تجريبية')`;
  await sql`insert into award_ceremonies(id, organization_id, year, label) values(${ceremonyId}, ${orgId}, 2050, 'دورة تجريبية')`;
  const initial = await workExport(sql, workId);
  const added = await prepare(
    {
      awards: [
        {
          organization: slug,
          category: "test-category",
          result: "nominee",
          year: 2050,
          ceremonyId,
          installment: 1,
          isFeatured: true,
          sourceUrl: "https://example.com/award",
          notes: "First",
          position: 0,
        },
      ],
    },
    ["awards"],
  );
  assert.equal(added.records[0].changes[0].path.startsWith("awards["), true);
  assert.deepEqual(await workExport(sql, workId), initial, "Award preparation must roll back");
  await commitWorkReview(added.ticket);
  const award = (await workExport(sql, workId)).awards![0];
  assert.equal(award.ceremonyId, ceremonyId);
  assert.equal(
    award.installment,
    1,
    "Award-only edits must resolve existing installment positions",
  );
  const changed = await prepare({ awards: [{ ...award, result: "winner", notes: "Revised" }] }, [
    "awards",
  ]);
  await commitWorkReview(changed.ticket);
  const revised = (await workExport(sql, workId)).awards![0];
  assert.equal(revised.id, award.id, "Editing must preserve award UUID");
  assert.equal(revised.result, "winner");
  assert.equal(revised.notes, "Revised");
  await assert.rejects(
    prepare({ awards: [{ ...revised, id: randomUUID() }] }, ["awards"]),
    /معرّف جائزة/,
  );
  await assert.rejects(prepare({ awards: [{ ...revised, year: 2051 }] }, ["awards"]), /ceremony/);
  const [{ id: assetId, path }] = await sql`select id, path from media_assets order by id limit 1`;
  const beforeImage = await workExport(sql, workId);
  const poster = await prepare(
    {
      installments: beforeImage.installments!.map((part) => ({
        ...part,
        media: { poster: String(path) },
      })),
    },
    ["installments"],
  );
  await commitWorkReview(poster.ticket);
  assert.equal((await workExport(sql, workId)).installments![0].media?.poster, path);
  assert.deepEqual(await inspectEpisodeDeletion(workId, episodeId), []);
  const beforeDeletion = await workExport(sql, workId);
  const remove = await prepare(
    {
      titleAr: "Must roll back",
      installments: beforeDeletion.installments!.map((part) => ({ ...part, episodes: [] })),
    },
    ["titleAr", "installments"],
  );
  assert.deepEqual(
    await workExport(sql, workId),
    beforeDeletion,
    "Deletion preparation must roll back",
  );
  await sql`insert into media_asset_assignments(asset_id, episode_id, role, is_primary) values(${assetId}, ${episodeId}, 'poster', true)`;
  assert.deepEqual(await inspectEpisodeDeletion(workId, episodeId), [
    { table: "media_asset_assignments", count: 1 },
  ]);
  await assert.rejects(commitWorkReview(remove.ticket), /ترتبط بسجلات/);
  assert.deepEqual(
    await workExport(sql, workId),
    beforeDeletion,
    "A newly linked episode must roll back every change in the plan",
  );
  await assert.rejects(
    prepare(
      { installments: beforeDeletion.installments!.map((part) => ({ ...part, episodes: [] })) },
      ["installments"],
    ),
    /ترتبط بسجلات/,
  );
  await sql`delete from media_asset_assignments where episode_id = ${episodeId}`;
  await commitWorkReview(remove.ticket);
  assert.equal((await workExport(sql, workId)).installments![0].episodes!.length, 0);
  const clearAwards = await prepare({ awards: [] }, ["awards"]);
  await commitWorkReview(clearAwards.ticket);
  assert.equal((await workExport(sql, workId)).awards!.length, 0);
  console.log(
    "PASS: award add/edit/delete and UUID preservation, scoped ceremony/part validation, installment artwork export, confirmed episode deletion, linked-record protection and atomic rollback. Disposable catalog only.",
  );
} finally {
  await sql`delete from titles where id = ${workId}`;
  await sql`delete from award_organizations where id = ${orgId}`;
  await sql`delete from audit_logs where target_id = ${workId}`;
  await closeDatabase();
}
