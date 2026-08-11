import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const duplicates = await sql`
  select i.title_id, array_agg(i.id order by i.position) as installment_ids
  from installments i
  join installment_scores s on s.installment_id=i.id
  group by i.title_id, s.story, s.characters, s.depth, s.world_building, s.originality, s.craft
  having count(*) > 1
`;
let removed = 0;
await sql.begin(async (tx) => {
  for (const group of duplicates) {
    const [, ...duplicateIds] = group.installment_ids as string[];
    if (!duplicateIds.length) continue;
    const result =
      await tx`delete from installment_scores where installment_id in ${tx(duplicateIds)}`;
    removed += result.count;
  }
});
await sql.end();
console.log(JSON.stringify({ duplicateGroups: duplicates.length, removed }, null, 2));
