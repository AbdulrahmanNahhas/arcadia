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
      "select count(*) as total from works where json_array_length(coalesce(json_extract(metadata, '$.genres'), '[]')) = 0"
    ),
    missingTags: scalar(
      "select count(*) as total from works where json_array_length(coalesce(json_extract(metadata, '$.tags'), '[]')) = 0"
    ),
    missingTones: scalar(
      "select count(*) as total from works where json_array_length(coalesce(json_extract(metadata, '$.tone'), '[]')) = 0"
    ),
    missingPosters: scalar(
      "select count(*) as total from works where not exists (select 1 from assets where assets.owner_type = 'work' and assets.owner_id = works.id and assets.asset_type = 'poster')"
    ),
    missingCredits: scalar(
      "select count(*) as total from works where not exists (select 1 from work_credits where work_credits.work_id = works.id)"
    ),
    missingLinks: scalar(
      "select count(*) as total from works where json_array_length(coalesce(json_extract(metadata, '$.externalLinks'), '[]')) = 0"
    ),
    missingCurationReview: scalar(
      "select count(*) as total from works where json_extract(metadata, '$.curation.reviewedAt') is null"
    ),
    duplicatedGuidanceTags: scalar(
      "select count(*) as total from works, json_each(works.metadata, '$.tags') where lower(json_each.value) like '%risk%' or lower(json_each.value) like '%fanservice%'"
    ),
    malformedTags: scalar(
      `select count(*) as total from works, json_each(works.metadata, '$.tags')
       where json_each.value <> lower(json_each.value)
          or json_each.value glob '* *'
          or json_each.value glob '*_*'`
    ),
    genreDuplicatingTags: scalar(
      `select count(*) as total from works, json_each(works.metadata, '$.tags')
       where json_each.value in ('action','adventure','comedy','drama','fantasy','historical','horror','mystery','music','psychological','romance','sci-fi','slice-of-life','sports','supernatural','thriller')`
    ),
    nonCanonicalGenres: scalar(
      `select count(*) as total from works, json_each(works.metadata, '$.genres')
       where json_each.value not in ('Action','Adventure','Comedy','Drama','Fantasy','Historical','Horror','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller')`
    ),
  },
}

console.log(JSON.stringify(report, null, 2))
