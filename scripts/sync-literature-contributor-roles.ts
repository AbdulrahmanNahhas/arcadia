import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import { entities, workContributors } from "../src/db/schema";
import type { WorkContribution } from "../src/features/library/model";

const corrections: Array<{
  workId: string;
  name: string;
  roles: WorkContribution["role"][];
}> = [
  {
    workId: "literature-manga-blue-box",
    name: "Kouji Miura",
    roles: ["author", "illustrator"],
  },
  {
    workId: "literature-manga-witchriv",
    name: "Hakuri",
    roles: ["author", "illustrator"],
  },
  {
    workId: "literature-manga-solo-leveling",
    name: "Chugong",
    roles: ["original-author"],
  },
  {
    workId: "literature-manga-solo-leveling",
    name: "h-goon",
    roles: ["writer"],
  },
  {
    workId: "literature-manga-solo-leveling",
    name: "DUBU",
    roles: ["illustrator"],
  },
  {
    workId: "literature-manga-three-days-of-happiness",
    name: "Sugaru Miaki",
    roles: ["original-author"],
  },
  {
    workId: "literature-manga-three-days-of-happiness",
    name: "Shouichi Taguchi",
    roles: ["illustrator"],
  },
  {
    workId: "literature-manga-ichi-the-witch",
    name: "Osamu Nishi",
    roles: ["writer"],
  },
  {
    workId: "literature-manga-ichi-the-witch",
    name: "Shiro Usazaki",
    roles: ["illustrator"],
  },
  {
    workId: "literature-manga-centuria",
    name: "Tohru Kuramori",
    roles: ["author", "illustrator"],
  },
];

let updated = 0;
db.transaction((tx) => {
  for (const correction of corrections) {
    const person = tx
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.entityType, "person"),
          eq(entities.sortName, correction.name.toLocaleLowerCase("en")),
        ),
      )
      .get();
    if (!person) continue;
    tx.delete(workContributors)
      .where(
        and(
          eq(workContributors.workId, correction.workId),
          eq(workContributors.entityId, person.id),
          inArray(workContributors.role, [
            "author",
            "creator",
            "illustrator",
            "original-author",
            "writer",
          ]),
        ),
      )
      .run();
    for (const [position, role] of correction.roles.entries()) {
      tx.insert(workContributors)
        .values({
          workId: correction.workId,
          entityId: person.id,
          role,
          position,
        })
        .onConflictDoNothing()
        .run();
    }
    updated += 1;
  }
});

console.log(`Corrected ${updated} literature contributor records.`);
