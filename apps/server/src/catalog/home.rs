//! Bounded, read-only home feeds. The enclosing catalog router requires owner authentication.
use super::{ApiResult, queries};
use axum::{Json, extract::State};
use serde_json::{Value, json};
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

pub(super) async fn feed(State(pool): State<PgPool>) -> ApiResult<Json<Value>> {
    // Keep the two feeds in one read-only snapshot and retain the existing discoverability rule.
    let mut transaction = pool.begin().await?;
    sqlx::query("set transaction isolation level repeatable read read only")
        .execute(&mut *transaction)
        .await?;
    let activity_sql = format!(
        r#"select coalesce(jsonb_agg(item order by created_at desc,kind,id),'[]'::jsonb) from (
select activity.created_at,activity.kind,activity.id,
jsonb_build_object('id',activity.id,'kind',activity.kind,'body',activity.body,
'containsSpoilers',activity.contains_spoilers,'rating',activity.rating,'createdAt',activity.created_at,
'authorName',a.display_name,'avatarKey',a.avatar_key,'work',({summary})) item
from (
select id,account_id,title_id,body,contains_spoilers,rating,created_at,'review'::text kind from title_reviews where moderation_status='published' and btrim(body)<>''
union all
select id,account_id,title_id,body,contains_spoilers,null::integer rating,created_at,'comment'::text kind from title_comments where moderation_status='published'
) activity join accounts a on a.id=activity.account_id join titles t on t.id=activity.title_id
where a.status='active' and a.is_discoverable and not t.is_private
order by activity.created_at desc,activity.kind,activity.id limit 6) entries"#,
        summary = queries::summary()
    );
    let comments = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(activity_sql))
        .fetch_one(&mut *transaction)
        .await?
        .0;
    let upcoming_sql = format!(
        r#"select coalesce(jsonb_agg(item order by release_date asc nulls last,work_title,position,id),'[]'::jsonb) from (
select i.release_date,t.sort_title work_title,i.position,i.id,jsonb_build_object(
'id',i.id,'workId',t.id,'workTitle',t.canonical_title,'workTitleAr',t.title_ar,'title',i.title,'kind',i.kind,
'releaseDate',i.release_date,'runtimeMinutes',i.runtime_minutes,
'episodeCount',(select count(*) from episodes e where e.installment_id=i.id),
'poster',coalesce((select jsonb_build_object('id',a.id,'url','/api/v1/artwork/'||a.id,'mimeType',a.mime_type,'width',a.width,'height',a.height,'byteSize',a.byte_size,'sha256',a.sha256,'originalFilename',a.original_filename,'focalX',a.focal_x,'focalY',a.focal_y) from media_asset_assignments m join media_assets a on a.id=m.asset_id where m.installment_id=i.id and m.role='poster' order by m.is_primary desc,m.id limit 1),({summary})->'poster'),
'score',jsonb_build_object('rating',floor(({score})*10+0.5)/10,'scored',case when ({score}) is null then 0 else 1 end,'total',1)) item
from installments i join titles t on t.id=i.title_id left join installment_scores s on s.installment_id=i.id
where not t.is_private and ((i.status='announced' and (i.release_date is null or i.release_date>=current_date)) or (i.status='unknown' and i.release_date>current_date))
order by i.release_date asc nulls last,t.sort_title,i.position,i.id limit 10) entries"#,
        summary = queries::SUMMARY,
        score = queries::SCORE_VALUE
    );
    let upcoming = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(upcoming_sql))
        .fetch_one(&mut *transaction)
        .await?
        .0;
    transaction.commit().await?;
    Ok(Json(json!({"comments":comments,"upcoming":upcoming})))
}
