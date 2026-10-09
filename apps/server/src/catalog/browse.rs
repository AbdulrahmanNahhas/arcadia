//! Paginated catalog discovery. Facet names and SQL fragments are server-owned; values are bound.
use super::{ApiError, ApiResult, queries};
use crate::auth::User;
use axum::http::StatusCode;
use axum::{
    Extension, Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Filters {
    #[serde(default)]
    facets: Vec<Selection>,
    #[serde(default)]
    minimum_rating: f64,
    #[serde(default)]
    minimum_scores: MinimumScores,
}
#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MinimumScores {
    #[serde(default)]
    story: f64,
    #[serde(default)]
    characters: f64,
    #[serde(default)]
    depth: f64,
    #[serde(default)]
    world_building: f64,
    #[serde(default)]
    originality: f64,
    #[serde(default)]
    craft: f64,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Selection {
    key: String,
    #[serde(default)]
    include: Vec<String>,
    #[serde(default)]
    exclude: Vec<String>,
}
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Input {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
    sort: Option<String>,
    view: Option<String>,
    privacy: Option<String>,
    filters: Option<String>,
    year_from: Option<i32>,
    year_to: Option<i32>,
}
const CRITERIA: [(&str, &str); 6] = [
    ("story", "story"),
    ("characters", "characters"),
    ("depth", "depth"),
    ("worldBuilding", "world_building"),
    ("originality", "originality"),
    ("craft", "craft"),
];
fn invalid() -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, "Invalid catalog filters")
}
impl Input {
    fn validated(&self) -> ApiResult<(i64, i64, &str, &str, &str, Filters)> {
        let page = self.page.unwrap_or(1);
        let size = self.page_size.unwrap_or(30);
        let view = self.view.as_deref().unwrap_or("works");
        let privacy = self.privacy.as_deref().unwrap_or("public");
        if !(1..=100_000).contains(&page)
            || !(1..=100).contains(&size)
            || !matches!(view, "works" | "installments")
            || !matches!(privacy, "public" | "all" | "private")
            || self.q.as_ref().is_some_and(|v| v.chars().count() > 200)
            || self.filters.as_ref().is_some_and(|v| v.len() > 8000)
            || self.year_from.is_some_and(|v| !(1..=9999).contains(&v))
            || self.year_to.is_some_and(|v| !(1..=9999).contains(&v))
            || self.year_from.zip(self.year_to).is_some_and(|(a, b)| a > b)
        {
            return Err(invalid());
        }
        let order = match self.sort.as_deref().unwrap_or("year-desc") {
            "title" => "sort_title,id,unit_id",
            "year-desc" => "release_sort desc nulls last,sort_title,id,unit_id",
            "year-asc" => "release_sort asc nulls last,sort_title,id,unit_id",
            "score-desc" => "rating desc nulls last,sort_title,id,unit_id",
            "updated-desc" => "updated_at desc,id,unit_id",
            "added-desc" => "created_at desc,id,unit_id",
            _ => return Err(invalid()),
        };
        let filters: Filters =
            serde_json::from_str(self.filters.as_deref().unwrap_or("{}")).map_err(|_| invalid())?;
        let values = [
            filters.minimum_rating,
            filters.minimum_scores.story,
            filters.minimum_scores.characters,
            filters.minimum_scores.depth,
            filters.minimum_scores.world_building,
            filters.minimum_scores.originality,
            filters.minimum_scores.craft,
        ];
        let keys = facets();
        if values
            .iter()
            .any(|v| !v.is_finite() || !(0.0..=10.0).contains(v))
            || filters.facets.len() > keys.len()
            || filters.facets.iter().any(|s| {
                !keys.iter().any(|(key, _, _)| *key == s.key)
                    || s.include.len() > 32
                    || s.exclude.len() > 32
                    || s.include
                        .iter()
                        .chain(&s.exclude)
                        .any(|v| v.is_empty() || v.len() > 160)
            })
        {
            return Err(invalid());
        }
        let mut seen = std::collections::HashSet::new();
        if filters
            .facets
            .iter()
            .any(|s| !seen.insert(&s.key) || s.include.iter().any(|v| s.exclude.contains(v)))
        {
            return Err(invalid());
        }
        Ok((page, size, view, privacy, order, filters))
    }
}
fn facets() -> Vec<(&'static str, &'static str, String)> {
    let mut list=vec![
        ("kinds","النوع","array[case when i.id is null then case when exists(select 1 from installments x where x.title_id=t.id and x.kind='season') then t.format::text||'-series' else t.format::text||'-movie' end else t.format::text||case when i.kind='season' then '-series' else '-movie' end end]".into()),
        ("releaseStatuses","حالة الإصدار","array[case when i.id is null then coalesce((select case when bool_or(x.status='airing') then 'airing' when bool_or(x.status='announced') then 'announced' when bool_and(x.status='completed') then 'completed' else 'unknown' end from installments x where x.title_id=t.id),'unknown') else i.status::text end]".into()),
        ("audiences","الجمهور","array[coalesce(i.audience_override,t.audience)::text]".into()),
        ("ages","الفئة العمرية","array[coalesce(i.age_override,t.age)::text]".into()),
        ("planets","الكواكب","array(select p.slug from title_planets v join planets p on p.id=v.planet_id where v.title_id=t.id and p.is_active)".into()),
        ("studios","الاستوديوهات","array(select distinct e.id::text from contributions c join entities e on e.id=c.entity_id where e.kind='organization' and c.title_id=t.id)".into()),
        ("contributors","الصنّاع","array(select distinct e.id::text from contributions c join entities e on e.id=c.entity_id where e.kind='person' and c.title_id=t.id)".into()),
        ("awardPrograms","جهات الجوائز","array(select distinct coalesce(organization_slug,organization_name) from award_recognitions where title_id=t.id and (i.id is null or installment_id is null or installment_id=i.id))".into()),
        ("awardCategories","فئات الجوائز","array(select distinct category from award_recognitions where title_id=t.id and (i.id is null or installment_id is null or installment_id=i.id))".into()),
        ("awardResults","نتائج الجوائز","array(select distinct result::text from award_recognitions where title_id=t.id and (i.id is null or installment_id is null or installment_id=i.id))".into()),
        ("ratingStates","حالة التقييم","array[case when rating is null then 'unrated' else 'rated' end]".into()),
        ("warningStates","تنبيهات المحتوى","array[case when coalesce(t.content_warnings,'')<>'' then 'warnings' else 'none' end]".into()),
        ("structureStates","البنية","array[case when i.id is null then 'title' when i.kind='season' then 'season' else 'standalone' end]".into()),
        ("playableStates","وجود فيديو مسجّل","array[case when exists(select 1 from media_files f where (f.installment_id in(select id from installments where title_id=t.id) or f.episode_id in(select e.id from episodes e join installments x on x.id=e.installment_id where x.title_id=t.id)) and (i.id is null or f.installment_id=i.id or f.episode_id in(select id from episodes where installment_id=i.id))) then 'available' else 'missing' end]".into()),
        ("watchStates","حالة المشاهدة","array[watch_state]".into()),
        ("favoriteStates","المفضلة","array[case when exists(select 1 from account_title_states ats join accounts a on a.id=ats.account_id where ats.title_id=t.id and a.auth_user_id=$1 and ats.is_favorite) then 'favorite' else 'other' end]".into()),
    ];
    for (key, label, table) in [
        ("genres", "الأنواع الفنية", "genres"),
        ("tones", "الطابع", "tones"),
        ("tags", "الوسوم", "tags"),
        ("countries", "البلدان", "countries"),
    ] {
        list.push((key,label,format!("array(select v.slug from title_{table} tv join {table} v on v.id=tv.value_id where tv.title_id=t.id)")));
    }
    for (key, label, field) in [
        ("sexualityRisks", "المحتوى الجنسي", "sexuality_risk"),
        ("behavioralRisks", "العنف والسلوك", "behavioral_risk"),
        ("theologyRisks", "الموضوعات العقدية", "theology_risk"),
    ] {
        list.push((
            key,
            label,
            format!("array[coalesce(i.{field}_override,t.{field})::text]"),
        ));
    }
    list
}
fn base() -> String {
    let work = queries::summary();
    let criteria=CRITERIA.iter().map(|(key,col)|format!("'{key}',case when i.id is null then (select avg(z.{col})::double precision from installments x left join installment_scores z on z.installment_id=x.id where x.title_id=t.id) else s.{col}::double precision end")).collect::<Vec<_>>().join(",");
    let facts = facets()
        .iter()
        .map(|(key, _, expr)| format!("'{key}',to_jsonb({expr})"))
        .collect::<Vec<_>>()
        .join(",");
    format!(
        r#"select t.id,i.id unit_id,t.sort_title,t.updated_at,t.created_at,
coalesce(i.release_date::text,t.release_year::text||'-01-01') release_sort,
coalesce(extract(year from i.release_date)::integer,t.release_year) as catalog_year,
coalesce(i.title,'') unit_title,t.canonical_title,t.title_ar,
jsonb_build_object('work',({work}),'installment',case when i.id is null then null else jsonb_build_object(
'id',i.id,'workId',t.id,'workTitle',t.canonical_title,'workTitleAr',t.title_ar,'title',i.title,'kind',i.kind,'releaseDate',i.release_date,'runtimeMinutes',i.runtime_minutes,
'episodeCount',(select count(*) from episodes where installment_id=i.id),'poster',coalesce((select {art} from media_asset_assignments m join media_assets a on a.id=m.asset_id where m.installment_id=i.id and m.role='poster' order by m.is_primary desc,m.id limit 1),({work})->'poster'),'score',score_value) end,
'classification',jsonb_build_object('audience',coalesce(i.audience_override,t.audience),'age',coalesce(i.age_override,t.age),'sexualityRisk',coalesce(i.sexuality_risk_override,t.sexuality_risk),'behavioralRisk',coalesce(i.behavioral_risk_override,t.behavioral_risk),'theologyRisk',coalesce(i.theology_risk_override,t.theology_risk)),
'status',case when i.id is null then 'title' else i.status::text end,'watchState',watch_state,'criteria',jsonb_build_object({criteria})) entry,
jsonb_build_object({facts}) facts,rating,jsonb_build_object({criteria}) criteria
from titles t left join installments i on i.title_id=t.id and $2='installments'
left join installment_scores s on s.installment_id=i.id
cross join lateral (select case when i.id is null then ({work})->'score' else jsonb_build_object('rating',floor(({score})*10+0.5)/10,'scored',case when ({score}) is null then 0 else 1 end,'total',1) end score_value) scores
cross join lateral (select (score_value->>'rating')::double precision rating) ratings
cross join lateral (select count(*) total,count(*) filter(where exists(select 1 from account_playback_states ps join accounts a on a.id=ps.account_id where a.auth_user_id=$1 and a.status='active' and ps.installment_id=units.installment_id and ps.episode_id is not distinct from units.episode_id and ps.is_played)) played from (
select x.id installment_id,e.id episode_id from installments x join episodes e on e.installment_id=x.id where x.title_id=t.id and (i.id is null or x.id=i.id) and (e.release_date<=current_date or (e.release_date is null and x.status='completed'))
union all select x.id,null::uuid from installments x where x.title_id=t.id and x.kind in('movie','special') and (i.id is null or x.id=i.id) and (x.release_date<=current_date or (x.release_date is null and x.status='completed'))
) units) tracking
cross join lateral (select case when tracking.total>0 and tracking.played=tracking.total then 'watched' when exists(select 1 from account_playback_states ps join accounts a on a.id=ps.account_id join installments x on x.id=ps.installment_id where a.auth_user_id=$1 and a.status='active' and x.title_id=t.id and (i.id is null or ps.installment_id=i.id) and (ps.position_seconds>0 or ps.is_played)) then 'in-progress' else 'unwatched' end watch_state) watch
where ($2='works' or i.id is not null) and ($3='all' or t.is_private=($3='private'))"#,
        art = queries::ARTWORK,
        score = queries::SCORE_VALUE
    )
}
fn condition() -> String {
    let mut parts=vec!["($5::text is null or strpos(lower(canonical_title||' '||coalesce(title_ar,'')||' '||unit_title),lower($5))>0 or exists(select 1 from title_aliases a where a.title_id=base.id and strpos(lower(a.title),lower($5))>0) or exists(select 1 from contributions c join entities e on e.id=c.entity_id where c.title_id=base.id and strpos(lower(e.name),lower($5))>0))".into(),"($6::integer is null or catalog_year>=$6)".into(),"($7::integer is null or catalog_year<=$7)".into(),"(coalesce(($4->>'minimumRating')::double precision,0)=0 or rating>=($4->>'minimumRating')::double precision)".into()];
    for (key, _, _) in facets() {
        parts.push(format!("not exists(select 1 from jsonb_array_elements(coalesce($4->'facets','[]')) sel where sel->>'key'='{key}' and ((jsonb_array_length(sel->'include')>0 and not (facts->'{key}' ?| array(select jsonb_array_elements_text(sel->'include')))) or facts->'{key}' ?| array(select jsonb_array_elements_text(sel->'exclude'))))"));
    }
    for (key, _) in CRITERIA {
        parts.push(format!("(coalesce(($4#>>'{{minimumScores,{key}}}')::double precision,0)=0 or (criteria->>'{key}')::double precision>=($4#>>'{{minimumScores,{key}}}')::double precision)"));
    }
    // Included award facets must match one recognition, not unrelated awards on the same work.
    parts.push("not exists(select 1 from jsonb_array_elements(coalesce($4->'facets','[]')) z where z->>'key' in('awardPrograms','awardCategories','awardResults') and jsonb_array_length(z->'include')>0) or exists(select 1 from award_recognitions ar where ar.title_id=base.id and (base.unit_id is null or ar.installment_id is null or ar.installment_id=base.unit_id) and not exists(select 1 from jsonb_array_elements(coalesce($4->'facets','[]')) z where z->>'key' in('awardPrograms','awardCategories','awardResults') and jsonb_array_length(z->'include')>0 and not (z->'include' ? (case z->>'key' when 'awardPrograms' then coalesce(ar.organization_slug,ar.organization_name) when 'awardCategories' then ar.category else ar.result::text end))))".into());
    parts
        .into_iter()
        .map(|s| format!("({s})"))
        .collect::<Vec<_>>()
        .join(" and ")
}
pub(super) async fn browse(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Query(input): Query<Input>,
) -> ApiResult<Json<Value>> {
    let (page, size, view, privacy, order, filters) = input.validated()?;
    let query = format!(
        "with base as ({base}), filtered as (select * from base where {condition}), page as (select entry,row_number() over(order by {order}) ord from filtered order by {order} limit $8 offset $9) select jsonb_build_object('items',coalesce((select jsonb_agg(entry order by ord) from page),'[]'::jsonb),'total',(select count(*) from filtered),'page',{page},'pageSize',{size})",
        base = base(),
        condition = condition()
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(user.id)
        .bind(view)
        .bind(privacy)
        .bind(sqlx::types::Json(filters))
        .bind(input.q.as_deref().filter(|v| !v.trim().is_empty()))
        .bind(input.year_from)
        .bind(input.year_to)
        .bind(size)
        .bind((page - 1) * size)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}
pub(super) async fn options(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Query(input): Query<Input>,
) -> ApiResult<Json<Value>> {
    let (_, _, view, privacy, _, _) = input.validated()?;
    let groups=facets().iter().map(|(key,label,_)|format!("select '{key}' key,'{label}' label,value,count(*)::bigint count from base cross join lateral jsonb_array_elements_text(facts->'{key}') v(value) group by value")).collect::<Vec<_>>().join(" union all ");
    let labels = r#"case when key in('genres','tones','tags','countries') then coalesce((select coalesce(label_ar,label_en) from (select 'genres' vocab,slug,label_ar,label_en from genres union all select 'tones',slug,label_ar,label_en from tones union all select 'tags',slug,label_ar,label_en from tags union all select 'countries',slug,label_ar,label_en from countries) vocabulary where vocab=key and slug=value limit 1),value) when key in('contributors','studios') then coalesce((select name from entities where id::text=value),value) when key='planets' then coalesce((select icon||' '||name_ar from planets where slug=value),value) else value end"#;
    let query = format!(
        "with base as ({base}), options as ({groups}), labelled as (select *,{labels} display from options), grouped as(select key,label,jsonb_agg(jsonb_build_object('value',value,'label',display,'count',count) order by count desc,value) options from labelled group by key,label) select jsonb_build_object('groups',coalesce((select jsonb_agg(jsonb_build_object('key',key,'label',label,'options',options) order by key) from grouped),'[]'::jsonb),'yearMin',(select min(catalog_year) from base),'yearMax',(select max(catalog_year) from base))",
        base = base()
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(user.id)
        .bind(view)
        .bind(privacy)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounds_and_facet_names_are_validated() {
        assert!(
            Input {
                filters: Some(
                    r#"{"facets":[{"key":"secret","include":["x"],"exclude":[]}]}"#.into()
                ),
                ..Input::default()
            }
            .validated()
            .is_err()
        );
        assert!(
            Input {
                page_size: Some(101),
                ..Input::default()
            }
            .validated()
            .is_err()
        );
        assert!(Input::default().validated().is_ok());
    }
}
