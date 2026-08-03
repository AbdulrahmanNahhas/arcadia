import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import { entities, externalLinks, workContributors, works } from "../src/db/schema";

type AniListStudio = {
  id: number;
  name: string;
  isAnimationStudio: boolean;
};

type AniListMedia = {
  id: number;
  studios: {
    edges: Array<{ isMain: boolean; node: AniListStudio | null }>;
  };
  staff: {
    edges: Array<{
      role: string;
      node: { id: number; name: { full: string } } | null;
    }>;
  };
};

const catalog = db
  .select({ id: works.id, title: works.canonicalTitle, kind: works.kind })
  .from(works)
  .all();
const catalogById = new Map(catalog.map((work) => [work.id, work]));
const links = db
  .select()
  .from(externalLinks)
  .where(eq(externalLinks.provider, "anilist"))
  .all()
  .filter((link) => catalogById.has(link.ownerId));

const workIdByAniListId = new Map<number, string>();
for (const link of links) {
  const match = link.url.match(/anilist\.co\/anime\/(\d+)/);
  const id = Number(link.externalId ?? match?.[1]);
  if (Number.isInteger(id) && id > 0) workIdByAniListId.set(id, link.ownerId);
}

const query = `
  query ProducerCompanies($ids: [Int], $page: Int) {
    Page(page: $page, perPage: 25) {
      media(id_in: $ids) {
        id
        studios {
          edges {
            isMain
            node { id name isAnimationStudio }
          }
        }
        staff(page: 1, perPage: 25, sort: [RELEVANCE, ID]) {
          edges { role node { id name { full } } }
        }
      }
    }
  }
`;

async function fetchCompanies(ids: number[]) {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables: { ids, page: 1 } }),
  });
  if (!response.ok) {
    throw new Error(`AniList returned ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as {
    data?: { Page?: { media?: AniListMedia[] } };
    errors?: Array<{ message: string }>;
  };
  if (payload.errors?.length) {
    throw new Error(payload.errors.map(({ message }) => message).join("; "));
  }
  return payload.data?.Page?.media ?? [];
}

const ids = [...workIdByAniListId.keys()];
const media: AniListMedia[] = [];
for (let offset = 0; offset < ids.length; offset += 25) {
  media.push(...(await fetchCompanies(ids.slice(offset, offset + 25))));
}

let linked = 0;
let peopleLinked = 0;
const touchedOrganizations = new Set<string>();
const touchedPeople = new Set<string>();

function mappedRoles(role: string) {
  const normalized = role.toLocaleLowerCase("en");
  if (normalized.includes("original creator")) return ["original-author"] as const;
  if (normalized === "story & art") return ["author", "illustrator"] as const;
  if (normalized === "story") return ["author"] as const;
  if (normalized === "art") return ["illustrator"] as const;
  if (normalized === "director" || normalized === "chief director") {
    return ["director"] as const;
  }
  if (normalized === "series composition") return ["writer"] as const;
  if (normalized === "script") return ["screenwriter"] as const;
  if (normalized === "music" || normalized === "music composer") {
    return ["composer"] as const;
  }
  return [];
}

db.transaction((tx) => {
  const mappedWorkIds = [...workIdByAniListId.values()];
  if (mappedWorkIds.length) {
    tx.delete(workContributors)
      .where(
        and(inArray(workContributors.workId, mappedWorkIds), eq(workContributors.role, "producer")),
      )
      .run();
  }

  for (const item of media) {
    const workId = workIdByAniListId.get(item.id);
    if (!workId) continue;
    const work = catalogById.get(workId);
    const producers = item.studios.edges
      .map(({ node }) => node)
      .filter((node): node is AniListStudio =>
        Boolean(node && !node.isAnimationStudio && node.name.trim()),
      )
      .filter((node, index, values) => values.findIndex(({ id }) => id === node.id) === index)
      .slice(0, 3);

    for (const [position, producer] of (work?.kind === "anime" ? producers : []).entries()) {
      const sortName = producer.name.trim().toLocaleLowerCase("en");
      let entity = tx
        .select()
        .from(entities)
        .where(and(eq(entities.entityType, "organization"), eq(entities.sortName, sortName)))
        .get();
      if (!entity) {
        const entityId = `anilist-organization-${producer.id}`;
        tx.insert(entities)
          .values({
            id: entityId,
            entityType: "organization",
            name: producer.name.trim(),
            sortName,
            metadata: { anilistId: producer.id, source: "anilist" },
          })
          .onConflictDoNothing()
          .run();
        entity = tx.select().from(entities).where(eq(entities.id, entityId)).get();
      }
      if (!entity) continue;
      tx.insert(workContributors)
        .values({
          workId,
          entityId: entity.id,
          role: "production-company",
          isPrimary: false,
          position: 100 + position,
        })
        .onConflictDoNothing()
        .run();
      linked += 1;
      touchedOrganizations.add(entity.id);
    }

    for (const [staffPosition, edge] of item.staff.edges.entries()) {
      if (!edge.node) continue;
      const roles = mappedRoles(edge.role);
      if (!roles.length) continue;
      const name = edge.node.name.full.trim();
      const sortName = name.toLocaleLowerCase("en");
      let person = tx
        .select()
        .from(entities)
        .where(and(eq(entities.entityType, "person"), eq(entities.sortName, sortName)))
        .get();
      if (!person) {
        const entityId = `anilist-person-${edge.node.id}`;
        tx.insert(entities)
          .values({
            id: entityId,
            entityType: "person",
            name,
            sortName,
            metadata: { anilistId: edge.node.id, source: "anilist" },
          })
          .onConflictDoNothing()
          .run();
        person = tx.select().from(entities).where(eq(entities.id, entityId)).get();
      }
      if (!person) continue;
      for (const [rolePosition, role] of roles.entries()) {
        tx.insert(workContributors)
          .values({
            workId,
            entityId: person.id,
            role,
            position: 200 + staffPosition * 2 + rolePosition,
          })
          .onConflictDoNothing()
          .run();
        peopleLinked += 1;
        touchedPeople.add(person.id);
      }
    }
  }
});

console.log(
  `Synced ${linked} primary producer links (${touchedOrganizations.size} organizations) and ${peopleLinked} creator links (${touchedPeople.size} people) across ${media.length} works.`,
);
