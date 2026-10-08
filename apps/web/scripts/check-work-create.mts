import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { closeDatabase, openDatabase } from "@arcadia/cli/db";
import type { WorkDocument } from "@arcadia/cli/work";
import { workExport } from "@arcadia/cli/work";

import { commitWorkReview, prepareNewWorkReview } from "../src/features/editor/work-edit.server";

const sql = openDatabase();
const [{ name }] = await sql`select current_database() as name`;
assert.equal(name, "nahhasio_dashboard_test", "Never run creation checks on the live catalog.");
const organizationId = randomUUID();
const categoryId = randomUUID();
const slug = `creation-test-${organizationId}`;
let createdId: string | null = null;
try {
  await sql`insert into award_organizations(id, slug, name_ar) values(${organizationId}, ${slug}, 'جهة تجريبية')`;
  await sql`insert into award_categories(id, organization_id, slug, name_ar) values(${categoryId}, ${organizationId}, 'test-category', 'فئة تجريبية')`;
  const [{ path }] = await sql`select path from media_assets order by id limit 1`;
  const [{ id: related }] = await sql`select id from titles order by id limit 1`;
  const [{ entity, role }] =
    await sql`select e.id::text as entity, r.slug as role from contributions c join entities e on e.id=c.entity_id join roles r on r.id=c.role_id where e.kind=r.entity_kind limit 1`;
  const document: WorkDocument = {
    canonicalTitle: `Disposable full work ${randomUUID()}`,
    titleAr: "عمل تجريبي كامل",
    format: "animated",
    aliases: ["alias"],
    trivia: ["fact"],
    summary: "summary",
    audience: "teen",
    age: "13+",
    sexualityRisk: "low",
    workflowStatus: "draft",
    media: { poster: String(path) },
    credits: [{ entity: String(entity), role: String(role), isPrimary: true, position: 0 }],
    relations: [{ target: String(related), kind: "related", notes: "linked" }],
    installments: [
      {
        kind: "season",
        title: "Season",
        position: 1,
        anilistId: 123,
        media: { poster: String(path) },
        score: { story: 8, characters: 7, depth: 6, worldBuilding: 9, originality: 8, craft: 7 },
        episodes: [{ number: 1, title: "Episode", position: 1 }],
      },
    ],
    awards: [
      {
        organization: slug,
        category: "test-category",
        result: "winner",
        installment: 1,
        year: 2050,
        position: 0,
      },
    ],
  };
  const review = await prepareNewWorkReview(JSON.stringify(document));
  const reviewId = review.records[0].id;
  assert.equal(
    (await sql`select id from titles where id = ${reviewId}`).length,
    0,
    "Preparing creation must roll back",
  );
  assert.equal(
    review.records[0].changes.some((change) => change.path === "installments"),
    true,
  );
  await assert.rejects(commitWorkReview(`${review.ticket}tampered`));
  const result = await commitWorkReview(review.ticket);
  createdId = result.createdId;
  assert.equal(createdId, reviewId, "Creation must retain the reviewed UUID");
  const stored = await workExport(sql, reviewId);
  assert.equal(stored.titleAr, document.titleAr);
  assert.equal(stored.installments![0].episodes![0].title, "Episode");
  assert.equal(stored.installments![0].media?.poster, path);
  assert.equal(stored.installments![0].score?.story, 8);
  assert.equal(stored.awards![0].result, "winner");
  assert.equal(stored.awards![0].installment, 1);
  assert.equal(stored.credits!.length, 1);
  assert.equal(stored.relations!.length, 1);
  await assert.rejects(prepareNewWorkReview(JSON.stringify(document)), /already exists/);
  await assert.rejects(commitWorkReview(review.ticket), /بالفعل/);
  await assert.rejects(
    prepareNewWorkReview(JSON.stringify({ ...document, id: related })),
    /معرّف عمل/,
  );
  console.log(
    "PASS: full signed creation review, rolled-back preparation, stable work/part/episode/award IDs, scores/artwork/contributions/relations, duplicate and replay protection. Disposable catalog only.",
  );
} finally {
  if (createdId) {
    await sql`delete from titles where id = ${createdId}`;
    await sql`delete from audit_logs where target_id = ${createdId}`;
  }
  await sql`delete from award_organizations where id = ${organizationId}`;
  await closeDatabase();
}
