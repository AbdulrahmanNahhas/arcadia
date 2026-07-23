import Database from "better-sqlite3"
import { join, resolve } from "node:path"

const databasePath = resolve(
  process.env.ARCADIA_DB_PATH ?? join(process.cwd(), "data", "arcadia.db")
)
const sqlite = new Database(databasePath, { readonly: true })

const scalar = (query: string) =>
  (sqlite.prepare(query).get() as { total: number }).total

const report = {
  databasePath,
  worksByKind: sqlite
    .prepare(
      "select kind, count(*) as total from works group by kind order by kind"
    )
    .all(),
  personalStatus: sqlite
    .prepare(
      "select status, count(*) as total from personal_state group by status order by status"
    )
    .all(),
  relationsByType: sqlite
    .prepare(
      "select relation_type as relationType, count(*) as total from work_relations group by relation_type order by relation_type"
    )
    .all(),
  checks: {
    foreignKeyIssues: sqlite.prepare("pragma foreign_key_check").all().length,
    orphanedAssets: scalar(
      "select count(*) as total from assets left join works on assets.owner_type = 'work' and assets.owner_id = works.id where assets.owner_type = 'work' and works.id is null"
    ),
    orphanedCredits: scalar(
      "select count(*) as total from work_credits left join works on work_credits.work_id = works.id left join entities on work_credits.entity_id = entities.id where works.id is null or entities.id is null"
    ),
    orphanedRelations: scalar(
      "select count(*) as total from work_relations left join works source on work_relations.source_work_id = source.id left join works target on work_relations.target_work_id = target.id where source.id is null or target.id is null"
    ),
    duplicateEntities: scalar(
      "select count(*) as total from (select entity_type, sort_name from entities group by entity_type, sort_name having count(*) > 1)"
    ),
    duplicateTerms: scalar(
      "select count(*) as total from (select vocabulary, slug from terms group by vocabulary, slug having count(*) > 1)"
    ),
    missingSummaries: scalar(
      "select count(*) as total from works where trim(summary) = ''"
    ),
    missingGenres: scalar(
      "select count(*) as total from works where not exists (select 1 from work_terms join terms on terms.id = work_terms.term_id where work_terms.work_id = works.id and terms.vocabulary = 'genre')"
    ),
    missingTags: scalar(
      "select count(*) as total from works where not exists (select 1 from work_terms join terms on terms.id = work_terms.term_id where work_terms.work_id = works.id and terms.vocabulary = 'tag')"
    ),
    missingTones: scalar(
      "select count(*) as total from works where not exists (select 1 from work_terms join terms on terms.id = work_terms.term_id where work_terms.work_id = works.id and terms.vocabulary = 'tone')"
    ),
    missingPosters: scalar(
      "select count(*) as total from works where not exists (select 1 from assets where assets.owner_type = 'work' and assets.owner_id = works.id and assets.asset_type = 'poster')"
    ),
    missingCredits: scalar(
      "select count(*) as total from works where not exists (select 1 from work_credits where work_credits.work_id = works.id)"
    ),
    missingLinks: scalar(
      "select count(*) as total from works where not exists (select 1 from external_links where external_links.owner_type = 'work' and external_links.owner_id = works.id)"
    ),
    missingCurationReview: scalar(
      "select count(*) as total from works where json_extract(metadata, '$.curation.reviewedAt') is null"
    ),
    duplicatedGuidanceTags: scalar(
      "select count(*) as total from work_terms join terms on terms.id = work_terms.term_id where terms.vocabulary = 'tag' and (lower(terms.name) like '%risk%' or lower(terms.name) like '%fanservice%')"
    ),
    malformedTags: scalar(
      `select count(*) as total from work_terms join terms on terms.id = work_terms.term_id
       where terms.vocabulary = 'tag'
         and (terms.slug <> lower(terms.slug)
           or terms.slug glob '* *'
           or terms.slug glob '*_*')`
    ),
    genreDuplicatingTags: scalar(
      `select count(*) as total from work_terms join terms on terms.id = work_terms.term_id
       where terms.vocabulary = 'tag'
         and terms.slug in ('action','adventure','comedy','drama','fantasy','historical','horror','mecha','military','music','mystery','political','psychological','romance','sci-fi','slice-of-life','sports','supernatural','thriller')`
    ),
    nonCanonicalGenres: scalar(
      `select count(*) as total from work_terms join terms on terms.id = work_terms.term_id
       where terms.vocabulary = 'genre'
         and terms.name not in ('Action','Adventure','Comedy','Drama','Fantasy','Historical','Horror','Mecha','Military','Music','Mystery','Political','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller')`
    ),
    nonCanonicalTones: scalar(
      `select count(*) as total from work_terms join terms on terms.id = work_terms.term_id
       where terms.vocabulary = 'tone'
         and terms.name not in ('Wholesome','Emotional','Bittersweet','Reflective','Tense','Hype / Energetic','Dark','Surreal / Whimsical','Epic','Atmospheric')`
    ),
  },
}

console.log(JSON.stringify(report, null, 2))
