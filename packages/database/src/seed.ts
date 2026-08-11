import { taxonomySeeds } from "@arcadia/domain";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const tableByVocabulary = { genres: "genres", tones: "tones", tags: "tags" } as const;
for (const seed of taxonomySeeds()) {
  const table = tableByVocabulary[seed.vocabulary];
  await sql`insert into ${sql(table)} (slug, label_en, label_ar, position) values (${seed.slug}, ${seed.labelEn}, ${seed.labelAr}, ${seed.position}) on conflict (slug) do update set label_en=excluded.label_en, label_ar=excluded.label_ar, position=excluded.position`;
}
await sql.end();
console.log(`Seeded ${taxonomySeeds().length} controlled taxonomy values.`);
