import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { entities, workContributors, works } from "../src/db/schema";

type WorkMetadata = {
  publication?: { publisher?: unknown } | null;
};

let linked = 0;
const publishers = new Set<string>();

db.transaction((tx) => {
  for (const work of tx.select().from(works).all()) {
    const metadata = work.metadata as WorkMetadata;
    const name =
      typeof metadata.publication?.publisher === "string"
        ? metadata.publication.publisher.trim()
        : "";
    if (!name) continue;
    const sortName = name.toLocaleLowerCase("en");
    let publisher = tx
      .select()
      .from(entities)
      .where(and(eq(entities.entityType, "organization"), eq(entities.sortName, sortName)))
      .get();
    if (!publisher) {
      const id = crypto.randomUUID();
      tx.insert(entities).values({ id, entityType: "organization", name, sortName }).run();
      publisher = tx.select().from(entities).where(eq(entities.id, id)).get();
    }
    if (!publisher) continue;
    tx.insert(workContributors)
      .values({
        workId: work.id,
        entityId: publisher.id,
        role: "publisher",
        position: 300,
      })
      .onConflictDoNothing()
      .run();
    linked += 1;
    publishers.add(publisher.id);
  }
});

console.log(
  `Synced ${linked} publication links across ${publishers.size} English publisher records.`,
);
