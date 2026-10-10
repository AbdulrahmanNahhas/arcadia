//! Owner-scoped personal state and published discussion. Never edits release/editorial data.
use super::{ApiError, ApiResult, tracking, validate_id};
use crate::auth::User;
use axum::{
    Extension, Json, Router,
    extract::Request,
    extract::{
        DefaultBodyLimit, Path, Query, State,
        rejection::{JsonRejection, QueryRejection},
    },
    http::{HeaderValue, StatusCode, header},
    middleware::{self, Next},
    response::Response,
    routing::get,
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::{AssertSqlSafe, PgPool, Postgres, Transaction, types::Json as SqlJson};

pub(super) fn routes() -> Router<PgPool> {
    Router::new()
        .route("/api/v1/works/{id}/state", get(state))
        .route("/api/v1/works/{id}/favorite", axum::routing::put(favorite))
        .route("/api/v1/works/{id}/watched", axum::routing::patch(watched))
        .route("/api/v1/works/{id}/activity", get(activity))
        .layer(DefaultBodyLimit::max(2048))
        .layer(middleware::from_fn(no_store))
}

async fn no_store(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FavoriteInput {
    is_favorite: bool,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WatchedInput {
    installment_id: Option<String>,
    episode_id: Option<String>,
    is_played: bool,
}
impl WatchedInput {
    fn validate(&self) -> ApiResult<()> {
        if self.episode_id.is_some() && self.installment_id.is_none() {
            return Err(invalid("An episode target requires its installment"));
        }
        for id in [&self.installment_id, &self.episode_id]
            .into_iter()
            .flatten()
        {
            validate_id(id)?;
        }
        Ok(())
    }
}
fn invalid(message: &'static str) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, message)
}
fn not_found() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "Work or watched target not found")
}
fn payload<T>(input: Result<Json<T>, JsonRejection>) -> ApiResult<T> {
    input
        .map(|Json(value)| value)
        .map_err(|_| invalid("Invalid viewer-state request"))
}

async fn begin(pool: &PgPool, write: bool) -> ApiResult<Transaction<'_, Postgres>> {
    let mut tx = pool.begin().await?;
    sqlx::query(if write {
        "SET TRANSACTION READ WRITE"
    } else {
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
    })
    .execute(&mut *tx)
    .await?;
    sqlx::query("SET LOCAL statement_timeout = '5s'")
        .execute(&mut *tx)
        .await?;
    sqlx::query("SET LOCAL lock_timeout = '2s'")
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

async fn account(
    tx: &mut Transaction<'_, Postgres>,
    user: &User,
    write: bool,
) -> ApiResult<String> {
    // Locking the account serializes overlapping bulk/single writes for this owner. Recheck
    // account/identity status inside the write transaction, not only in middleware.
    let query = format!(
        "SELECT a.id::text FROM accounts a JOIN auth_users u ON u.id=a.auth_user_id WHERE u.id=$1 AND a.status='active' AND u.role='owner' AND (NOT u.banned OR u.ban_expires<=now()){}",
        if write { " FOR UPDATE OF a,u" } else { "" }
    );
    sqlx::query_scalar(AssertSqlSafe(query))
        .bind(&user.id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(ApiError(StatusCode::UNAUTHORIZED, "Account is unavailable"))
}
async fn ensure_work(tx: &mut Transaction<'_, Postgres>, id: &str, write: bool) -> ApiResult<()> {
    let query = if write {
        "select id::text from titles where id=$1::uuid for share"
    } else {
        "select id::text from titles where id=$1::uuid"
    };
    sqlx::query_scalar::<_, String>(query)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(not_found)?;
    Ok(())
}

fn state_query() -> String {
    format!(
        r#"with units as ({units}), states as (
select units.*,ps.id state_id,coalesce(ps.position_seconds,0) position_seconds,ps.duration_seconds,
coalesce(ps.is_played,false) is_played,coalesce(ps.played_manually,false) played_manually,
ps.played_at,ps.subtitle_offset_ms,ps.updated_at
from units left join account_playback_states ps on ps.account_id=$2::uuid
and ps.installment_id=units.installment_id and ps.episode_id is not distinct from units.episode_id)
select jsonb_build_object('workId',$1::uuid,
'isFavorite',coalesce((select is_favorite from account_title_states where account_id=$2::uuid and title_id=$1::uuid),false),
'units',coalesce((select jsonb_agg(jsonb_build_object('stateId',state_id,'installmentId',installment_id,'episodeId',episode_id,
'isReleased',coalesce(is_released,false),'positionSeconds',position_seconds,'durationSeconds',duration_seconds,
'isPlayed',is_played,'playedManually',played_manually,'playedAt',played_at,'subtitleOffsetMs',subtitle_offset_ms,'updatedAt',updated_at)
order by installment_position,installment_id,episode_position,episode_id) from states),'[]'::jsonb),
'summary',(select {summary} from (select {counts} from states) tracking),
'installments',coalesce((select jsonb_agg(jsonb_build_object('installmentId',x.id,'summary',{summary}) order by x.position,x.id)
from installments x cross join lateral (select {counts} from states where installment_id=x.id) tracking
where x.title_id=$1::uuid),'[]'::jsonb))"#,
        units = tracking::units("$1::uuid", "null::uuid"),
        summary = tracking::summary(),
        counts = tracking::COUNTS
    )
}
async fn snapshot(
    tx: &mut Transaction<'_, Postgres>,
    work: &str,
    account: &str,
) -> ApiResult<Value> {
    Ok(
        sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(state_query()))
            .bind(work)
            .bind(account)
            .fetch_one(&mut **tx)
            .await?
            .0,
    )
}

async fn state(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    validate_id(&id)?;
    let mut tx = begin(&pool, false).await?;
    let account = account(&mut tx, &user, false).await?;
    ensure_work(&mut tx, &id, false).await?;
    let result = snapshot(&mut tx, &id, &account).await?;
    tx.commit().await?;
    Ok(Json(result))
}

const FAVORITE_WRITE: &str = "insert into account_title_states(account_id,title_id,is_favorite) values($1::uuid,$2::uuid,$3) on conflict(account_id,title_id) do update set is_favorite=excluded.is_favorite,updated_at=now()";
async fn favorite(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Path(id): Path<String>,
    input: Result<Json<FavoriteInput>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    validate_id(&id)?;
    let input = payload(input)?;
    let mut tx = begin(&pool, true).await?;
    let account = account(&mut tx, &user, true).await?;
    ensure_work(&mut tx, &id, true).await?;
    sqlx::query(FAVORITE_WRITE)
        .bind(&account)
        .bind(&id)
        .bind(input.is_favorite)
        .execute(&mut *tx)
        .await?;
    let result = snapshot(&mut tx, &id, &account).await?;
    tx.commit().await?;
    Ok(Json(result))
}

async fn validate_target(
    tx: &mut Transaction<'_, Postgres>,
    work: &str,
    input: &WatchedInput,
) -> ApiResult<()> {
    if let Some(installment) = &input.installment_id {
        let kind = sqlx::query_scalar::<_, String>(
            "select kind::text from installments where id=$1::uuid and title_id=$2::uuid for share",
        )
        .bind(installment)
        .bind(work)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(not_found)?;
        if let Some(episode) = &input.episode_id {
            if kind != "season" {
                return Err(invalid("Movie and special targets cannot have an episode"));
            }
            sqlx::query_scalar::<_, String>("select id::text from episodes where id=$1::uuid and installment_id=$2::uuid for share")
                .bind(episode).bind(installment).fetch_optional(&mut **tx).await?.ok_or_else(not_found)?;
        }
    }
    Ok(())
}
fn watched_query() -> String {
    format!(
        r#"insert into account_playback_states(account_id,installment_id,episode_id,is_played,played_manually,played_at)
select $2::uuid,installment_id,episode_id,$5,true,case when $5 then now() else null end
from ({units}) targets where ($4::uuid is null or episode_id=$4::uuid)
order by installment_id,episode_id
on conflict on constraint account_playback_owner_uq do update set
is_played=excluded.is_played,played_manually=true,
played_at=case when excluded.is_played then coalesce(account_playback_states.played_at,excluded.played_at) else null end,
updated_at=now()"#,
        units = tracking::units("$1::uuid", "$3::uuid")
    )
}
async fn watched(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Path(id): Path<String>,
    input: Result<Json<WatchedInput>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    validate_id(&id)?;
    let input = payload(input)?;
    input.validate()?;
    let mut tx = begin(&pool, true).await?;
    let account = account(&mut tx, &user, true).await?;
    ensure_work(&mut tx, &id, true).await?;
    validate_target(&mut tx, &id, &input).await?;
    // No release filter: an explicit manual work/season choice includes future catalog units.
    sqlx::query(AssertSqlSafe(watched_query()))
        .bind(&id)
        .bind(&account)
        .bind(input.installment_id)
        .bind(input.episode_id)
        .bind(input.is_played)
        .execute(&mut *tx)
        .await?;
    let result = snapshot(&mut tx, &id, &account).await?;
    tx.commit().await?;
    Ok(Json(result))
}

#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
struct ActivityQuery {
    page: Option<i64>,
}
impl ActivityQuery {
    fn page(&self) -> ApiResult<i64> {
        let page = self.page.unwrap_or(1);
        if !(1..=100_000).contains(&page) {
            return Err(invalid("Invalid discussion page"));
        }
        Ok(page)
    }
}
const ACTIVITY_SQL: &str = r#"with entries as (
select r.id,r.account_id,r.body,r.contains_spoilers,r.rating,null::uuid parent_id,r.created_at,r.updated_at,'review'::text kind
from title_reviews r where r.title_id=$1::uuid and r.moderation_status='published'
union all
select c.id,c.account_id,c.body,c.contains_spoilers,null::integer,c.parent_id,c.created_at,c.updated_at,'comment'::text
from title_comments c where c.title_id=$1::uuid and c.moderation_status='published'),
visible as (select e.*,a.display_name,a.avatar_key from entries e join accounts a on a.id=e.account_id where a.status='active' and a.is_discoverable),
page as (select * from visible order by created_at desc,kind,id limit 20 offset (($2::bigint-1)*20))
select jsonb_build_object('workId',$1::uuid,'page',$2::bigint,'pageSize',20,'total',(select count(*) from visible),
'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'body',body,'containsSpoilers',contains_spoilers,
'rating',rating,'parentId',parent_id,'author',jsonb_build_object('id',account_id,'displayName',display_name,'avatarKey',avatar_key),
'createdAt',created_at,'updatedAt',updated_at) order by created_at desc,kind,id) from page),'[]'::jsonb))"#;
async fn activity(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Path(id): Path<String>,
    input: Result<Query<ActivityQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    validate_id(&id)?;
    let Query(input) = input.map_err(|_| invalid("Invalid discussion query"))?;
    let page = input.page()?;
    let mut tx = begin(&pool, false).await?;
    account(&mut tx, &user, false).await?;
    ensure_work(&mut tx, &id, false).await?;
    let result = sqlx::query_scalar::<_, SqlJson<Value>>(ACTIVITY_SQL)
        .bind(&id)
        .bind(page)
        .fetch_one(&mut *tx)
        .await?
        .0;
    tx.commit().await?;
    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    const ID: &str = "00112233-4455-6677-8899-aabbccddeeff";

    #[test]
    fn strict_targets_require_real_identifiers_and_parent_context() {
        for value in [
            json!({"isPlayed":true,"accountId":ID}),
            json!({"isPlayed":"true"}),
            json!({}),
        ] {
            assert!(serde_json::from_value::<WatchedInput>(value).is_err());
        }
        for (installment, episode, valid) in [
            (None, None, true),
            (Some(ID), None, true),
            (Some(ID), Some(ID), true),
            (None, Some(ID), false),
            (Some("../secret"), None, false),
        ] {
            let input = WatchedInput {
                installment_id: installment.map(str::to_owned),
                episode_id: episode.map(str::to_owned),
                is_played: true,
            };
            assert_eq!(input.validate().is_ok(), valid);
        }
        assert!(
            serde_json::from_value::<FavoriteInput>(json!({"isFavorite":true,"notes":"overwrite"}))
                .is_err()
        );
    }
    #[test]
    fn manual_writes_preserve_progress_and_identity() {
        let sql = watched_query();
        let update = sql.split("do update set").nth(1).unwrap();
        for field in [
            "position_seconds=",
            "duration_seconds=",
            "subtitle_offset_ms=",
            "id=",
        ] {
            assert!(!update.contains(field));
        }
        assert!(update.contains("played_manually=true"));
        assert!(update.contains("else null end"));
        assert!(!sql.contains("where is_released"));
        assert!(sql.contains("account_playback_owner_uq"));
        assert!(!FAVORITE_WRITE.contains("personal_rating="));
        assert!(!FAVORITE_WRITE.contains("notes="));
        assert!(!FAVORITE_WRITE.contains("saved_offline="));
    }
    #[test]
    fn state_reads_are_account_scoped_and_include_defaults_for_unrecorded_units() {
        let sql = state_query();
        assert!(sql.contains("ps.account_id=$2::uuid"));
        assert!(sql.contains("account_id=$2::uuid and title_id=$1::uuid"));
        assert!(sql.contains("coalesce(ps.is_played,false)"));
        assert!(sql.contains("coalesce(ps.position_seconds,0)"));
    }
    #[test]
    fn discussion_is_bounded_and_filters_authors_and_moderation() {
        assert_eq!(ActivityQuery::default().page().unwrap(), 1);
        for page in [0, -1, 100_001] {
            assert!(ActivityQuery { page: Some(page) }.page().is_err());
        }
        assert!(serde_json::from_value::<ActivityQuery>(json!({"page":1,"accountId":ID})).is_err());
        assert_eq!(
            ACTIVITY_SQL
                .matches("moderation_status='published'")
                .count(),
            2
        );
        assert!(ACTIVITY_SQL.contains("a.status='active' and a.is_discoverable"));
        assert!(ACTIVITY_SQL.contains("limit 20"));
        assert!(ACTIVITY_SQL.contains("order by created_at desc,kind,id"));
    }
}
