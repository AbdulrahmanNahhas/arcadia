import { openDatabase, type TransactionSql } from "@arcadia/cli/db";
import { workScore, type WorkScore } from "@arcadia/domain";
import { z } from "zod";

const installmentScoreRowSchema = z.object({
  title_id: z.string().uuid(),
  story: z.number().nullable(),
  characters: z.number().nullable(),
  depth: z.number().nullable(),
  world_building: z.number().nullable(),
  originality: z.number().nullable(),
  craft: z.number().nullable(),
});

export async function loadTitleScores(transaction: TransactionSql, titleIds: string[]) {
  const scores = new Map<string, WorkScore>();
  if (!titleIds.length) return scores;
  const rows = z.array(installmentScoreRowSchema).parse(
    await transaction`
    select i.title_id,
      s.story::double precision as story,
      s.characters::double precision as characters,
      s.depth::double precision as depth,
      s.world_building::double precision as world_building,
      s.originality::double precision as originality,
      s.craft::double precision as craft
    from installments i left join installment_scores s on s.installment_id = i.id
    where i.title_id in ${transaction([...new Set(titleIds)])}
    order by i.title_id, i.position, i.id
  `,
  );
  for (const titleId of new Set(titleIds)) {
    scores.set(
      titleId,
      workScore(
        rows
          .filter((row) => row.title_id === titleId)
          .map((row) => ({
            story: row.story,
            characters: row.characters,
            depth: row.depth,
            worldBuilding: row.world_building,
            originality: row.originality,
            craft: row.craft,
          })),
      ),
    );
  }
  return scores;
}

export async function getTitleScores(titleIds: string[]) {
  const sql = openDatabase();
  return sql.begin("isolation level repeatable read read only", (transaction) =>
    loadTitleScores(transaction, titleIds),
  );
}
