//! Client source resolution and transfers. Catalog authorization stays in Services.
use crate::{
    bridge::{Error, Request, valid_id},
    media_gateway::Gateway,
    media_storage::Roots,
    services::Services,
    torrentio,
};
use media_transfer::{Engine, File, TorrentId};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, OnceCell};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Target {
    pub work_id: String,
    pub installment_id: Option<String>,
    pub episode_id: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedTarget {
    pub work_id: String,
    pub installment_id: String,
    pub episode_id: Option<String>,
    pub title: String,
    #[serde(skip_serializing)]
    pub search: torrentio::Search,
}
#[derive(Deserialize)]
#[serde(
    tag = "command",
    content = "payload",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Command {
    #[serde(rename = "media.search")]
    Search { session_id: String, target: Target },
    #[serde(rename = "media.play")]
    Play {
        session_id: String,
        source_id: String,
        file_index: Option<u32>,
    },
    #[serde(rename = "media.keep")]
    Keep { session_id: String },
    #[serde(rename = "media.jobs")]
    Jobs {},
    #[serde(rename = "media.pause")]
    Pause { id: String },
    #[serde(rename = "media.resume")]
    Resume { id: String },
}
impl Command {
    pub fn parse(request: &Request) -> Result<Self, Error> {
        serde_json::from_value(json!({"command": request.command,"payload":request.payload}))
            .map_err(|_| Error::new("bad_request", "Invalid media request"))
    }
    pub fn session(&self) -> Option<&str> {
        match self {
            Self::Search { session_id, .. }
            | Self::Play { session_id, .. }
            | Self::Keep { session_id } => Some(session_id),
            _ => None,
        }
    }
}
#[derive(Clone)]
struct Source {
    session: String,
    target: Target,
    resolved: ResolvedTarget,
    candidate: torrentio::Candidate,
    created: Instant,
}
pub struct Media {
    services: Services,
    roots: Roots,
    engine: OnceCell<Engine>,
    sources: Mutex<BTreeMap<String, Source>>,
}
pub enum Ready {
    Choices {
        files: Vec<File>,
        target: ResolvedTarget,
    },
    Playing {
        gateway: Gateway,
        target: ResolvedTarget,
    },
}
#[derive(Serialize)]
pub struct Sources {
    pub target: ResolvedTarget,
    pub candidates: Vec<Value>,
}
impl Media {
    pub fn new(services: Services) -> Result<Arc<Self>, Error> {
        Ok(Arc::new(Self {
            services,
            roots: Roots::discover().map_err(|_| transfer_error())?,
            engine: OnceCell::new(),
            sources: Mutex::new(BTreeMap::new()),
        }))
    }
    async fn engine(&self) -> Result<Engine, Error> {
        self.engine
            .get_or_try_init(|| async {
                let roots = self.roots.clone();
                tokio::task::spawn_blocking(move || Engine::open(roots.state, roots.videos))
                    .await
                    .map_err(|_| transfer_error())?
                    .map_err(|_| transfer_error())
            })
            .await
            .cloned()
    }
    pub async fn search(&self, session: String, target: Target) -> Result<Sources, Error> {
        let resolved = self.resolve(&target).await?;
        let candidates = torrentio::search(resolved.search.clone()).await?;
        let views = candidates
            .iter()
            .map(torrentio::Candidate::public_value)
            .collect::<Result<Vec<_>, _>>()?;
        let mut sources = self.sources.lock().await;
        sources.retain(|_, source| {
            source.session == session && source.created.elapsed() < Duration::from_secs(900)
        });
        for candidate in candidates {
            sources.insert(
                candidate.id.clone(),
                Source {
                    session: session.clone(),
                    target: target.clone(),
                    resolved: resolved.clone(),
                    candidate,
                    created: Instant::now(),
                },
            );
        }
        Ok(Sources {
            target: resolved,
            candidates: views,
        })
    }
    pub async fn play(
        &self,
        session: &str,
        source_id: &str,
        explicit_file: Option<u32>,
    ) -> Result<Ready, Error> {
        let source = self
            .sources
            .lock()
            .await
            .get(source_id)
            .cloned()
            .filter(|source| {
                source.session == session && source.created.elapsed() < Duration::from_secs(900)
            })
            .ok_or_else(|| Error::new("stale_source", "أعد البحث عن مصادر هذا الفيديو."))?;
        // Re-check catalog access/release/mapping immediately before playback.
        let resolved = self.resolve(&source.target).await?;
        if resolved.work_id != source.resolved.work_id
            || resolved.installment_id != source.resolved.installment_id
            || resolved.episode_id != source.resolved.episode_id
            || resolved.search.imdb_id != source.resolved.search.imdb_id
        {
            return Err(Error::new(
                "stale_source",
                "تغيّرت بيانات العمل. أعد البحث عن المصدر.",
            ));
        }
        let hash =
            source.candidate.info_hash.as_ref().ok_or_else(|| {
                Error::new("unsupported_source", "المصادر المباشرة ليست مربوطة بعد.")
            })?;
        let mut magnet = url::Url::parse("magnet:?").map_err(|_| transfer_error())?;
        {
            let mut query = magnet.query_pairs_mut();
            query.append_pair(
                "xt",
                &if hash.len() == 40 {
                    format!("urn:btih:{hash}")
                } else {
                    format!("urn:btmh:1220{hash}")
                },
            );
            for tracker in source.candidate.trackers.iter().take(16) {
                query.append_pair("tr", tracker);
            }
        }
        let engine = self.engine().await?;
        let importer = engine.clone();
        let id = tokio::task::spawn_blocking(move || importer.import_magnet(magnet.into()))
            .await
            .map_err(|_| transfer_error())?
            .map_err(|_| transfer_error())?;
        let start_engine = engine.clone();
        let start_id = id.clone();
        tokio::task::spawn_blocking(move || start_engine.start(&start_id))
            .await
            .map_err(|_| transfer_error())?
            .map_err(|_| transfer_error())?;
        let deadline = Instant::now() + Duration::from_secs(30);
        let files = loop {
            let reader = engine.clone();
            let reader_id = id.clone();
            let result = tokio::task::spawn_blocking(move || reader.files(&reader_id))
                .await
                .map_err(|_| transfer_error())?;
            match result {
                Ok(files) => break files,
                Err(media_transfer::Error::Native(message))
                    if message == "metadata pending" && Instant::now() < deadline =>
                {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
                _ => {
                    pause_unowned(engine, id).await;
                    return Err(Error::new(
                        "metadata_unavailable",
                        "تعذّر جلب معلومات التورنت. اختر مصدرًا آخر.",
                    ));
                }
            }
        };
        let videos: Vec<File> = files
            .into_iter()
            .filter(|file| is_video(&file.path))
            .collect();
        let index = explicit_file
            .or(source.candidate.file_index)
            .or_else(|| (videos.len() == 1).then(|| videos[0].index));
        let Some(file) =
            index.and_then(|index| videos.iter().find(|file| file.index == index).cloned())
        else {
            pause_unowned(engine, id).await;
            return Ok(Ready::Choices {
                files: videos,
                target: resolved,
            });
        };
        let lease_engine = engine.clone();
        let lease_id = id.clone();
        let index = file.index;
        let lease = tokio::task::spawn_blocking(move || {
            lease_engine.playback_lease(&lease_id, vec![index])
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())?;
        let gateway = Gateway::start(engine, id, file, lease)
            .await
            .map_err(|_| transfer_error())?;
        Ok(Ready::Playing {
            gateway,
            target: resolved,
        })
    }
    pub async fn keep(&self, id: TorrentId, file: u32) -> Result<(), Error> {
        let engine = self.engine().await?;
        tokio::task::spawn_blocking(move || engine.keep_file(&id, file))
            .await
            .map_err(|_| transfer_error())?
            .map_err(|_| transfer_error())
    }
    pub async fn jobs(&self) -> Result<Value, Error> {
        let engine = self.engine().await?;
        tokio::task::spawn_blocking(move || {
            let jobs = engine.jobs()?;
            let mut result = Vec::new();
            for job in jobs {
                if !job.selected.is_empty() {
                    let status = engine.status(&job.id)?;
                    let files = engine.files(&job.id).unwrap_or_default();
                    result.push(json!({"id":job.id.0,"files":files,"selected":job.selected,"status":status}));
                }
            }
            Ok::<_, media_transfer::Error>(Value::Array(result))
        }).await.map_err(|_| transfer_error())?.map_err(|_| transfer_error())
    }
    pub async fn set_paused(&self, id: String, paused: bool) -> Result<(), Error> {
        if id.len() > 80
            || !id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err(transfer_error());
        }
        let engine = self.engine().await?;
        tokio::task::spawn_blocking(move || {
            if paused {
                engine.pause(&TorrentId(id))
            } else {
                engine.resume(&TorrentId(id))
            }
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())
    }
    async fn resolve(&self, target: &Target) -> Result<ResolvedTarget, Error> {
        if !valid_id(&target.work_id)
            || target
                .installment_id
                .as_ref()
                .is_some_and(|id| !valid_id(id))
            || target.episode_id.as_ref().is_some_and(|id| !valid_id(id))
        {
            return Err(Error::new("bad_request", "Invalid playback target"));
        }
        let work = self
            .services
            .execute(Request {
                id: "source-catalog".into(),
                command: "work".into(),
                payload: json!({"id":target.work_id}),
            })
            .await?;
        resolve_target(&work, target)
    }
}
async fn pause_unowned(engine: Engine, id: TorrentId) {
    let _ = tokio::task::spawn_blocking(move || engine.pause_if_unowned(&id)).await;
}
pub fn is_video(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            [
                "mkv", "mp4", "m4v", "webm", "avi", "mov", "ts", "m2ts", "ogv", "mpeg", "mpg",
            ]
            .contains(&extension.to_ascii_lowercase().as_str())
        })
}
fn eligible(item: &Value) -> bool {
    if item["status"] == "announced" || item["releaseState"] == "upcoming" {
        return false;
    }
    item["releaseDate"]
        .as_str()
        .and_then(|date| chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").ok())
        .is_none_or(|date| date <= chrono::Utc::now().date_naive())
}
fn resolve_target(work: &Value, target: &Target) -> Result<ResolvedTarget, Error> {
    let installments = work["installments"].as_array().ok_or_else(transfer_error)?;
    let installment = match &target.installment_id {
        Some(id) => installments
            .iter()
            .find(|item| item["id"].as_str() == Some(id)),
        None => installments.iter().find(|item| eligible(item)),
    }
    .ok_or_else(|| Error::new("upcoming", "لا يوجد إصدار متاح للتشغيل لهذا العمل."))?;
    if !eligible(installment) {
        return Err(Error::new(
            "upcoming",
            "هذا الإصدار قادم؛ لا يبدأ تشغيله تلقائيًا.",
        ));
    }
    let series = installment["kind"] == "season";
    let title = work["titleAr"]
        .as_str()
        .filter(|title| !title.is_empty())
        .or_else(|| work["canonicalTitle"].as_str())
        .unwrap_or("Video");
    let (episode_id, search, title) = if series {
        let episodes = installment["episodes"]
            .as_array()
            .ok_or_else(transfer_error)?;
        let episode = match &target.episode_id {
            Some(id) => episodes
                .iter()
                .find(|episode| episode["id"].as_str() == Some(id)),
            None => episodes.iter().find(|episode| eligible(episode)),
        }
        .ok_or_else(|| Error::new("upcoming", "اختر حلقة غير قادمة لبدء التشغيل."))?;
        if !eligible(episode) {
            return Err(Error::new("upcoming", "هذه الحلقة قادمة."));
        }
        let number = episode["number"]
            .as_str()
            .and_then(|number| number.parse::<u32>().ok())
            .ok_or_else(|| {
                Error::new(
                    "source_mapping",
                    "رقم الحلقة لا يدعم معرّف Torrentio القياسي.",
                )
            })?;
        // Same rule as the historical Tauri API: ordinal among seasons, excluding films/specials.
        let position = installment["position"]
            .as_i64()
            .ok_or_else(transfer_error)?;
        let season = installments
            .iter()
            .filter(|item| {
                item["kind"] == "season"
                    && item["position"]
                        .as_i64()
                        .is_some_and(|value| value < position)
            })
            .count() as u32
            + 1;
        (
            episode["id"].as_str().map(str::to_owned),
            torrentio::Search {
                imdb_id: imdb(work)?.to_owned(),
                kind: torrentio::Kind::Series,
                season: Some(season),
                episode: Some(number),
            },
            format!("{title} · الحلقة {number}"),
        )
    } else {
        let only_film = installments
            .iter()
            .filter(|item| item["kind"] != "season")
            .count()
            == 1;
        let identifier =
            imdb(installment).or_else(|error| if only_film { imdb(work) } else { Err(error) })?;
        (
            None,
            torrentio::Search {
                imdb_id: identifier.to_owned(),
                kind: torrentio::Kind::Movie,
                season: None,
                episode: None,
            },
            title.to_owned(),
        )
    };
    Ok(ResolvedTarget {
        work_id: target.work_id.clone(),
        installment_id: installment["id"]
            .as_str()
            .ok_or_else(transfer_error)?
            .to_owned(),
        episode_id,
        title,
        search,
    })
}
fn imdb(item: &Value) -> Result<&str, Error> {
    item["externalIds"]["imdbId"]
        .as_str()
        .filter(|id| !id.is_empty())
        .ok_or_else(|| {
            Error::new(
                "no_identifier",
                "هذا الإصدار لا يحمل معرّف IMDb صالحًا للتشغيل.",
            )
        })
}
fn transfer_error() -> Error {
    Error::new(
        "transfer",
        "تعذّر تجهيز نقل الفيديو. تحقق من المصدر والتخزين ثم أعد المحاولة.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    fn target() -> Target {
        Target {
            work_id: "00000000-0000-4000-8000-000000000001".into(),
            installment_id: None,
            episode_id: None,
        }
    }
    #[test]
    fn films_require_unambiguous_imdb_and_reject_upcoming() {
        let mut work = json!({"canonicalTitle":"Fixture","externalIds":{"imdbId":"tt1234567"},
            "installments":[{"id":"film","kind":"movie","status":"completed","externalIds":{"imdbId":null}}]});
        assert_eq!(
            resolve_target(&work, &target()).unwrap().search.imdb_id,
            "tt1234567"
        );
        work["installments"][0]["status"] = json!("announced");
        assert!(resolve_target(&work, &target()).is_err());
        work["installments"][0]["status"] = json!("completed");
        work["installments"]
            .as_array_mut()
            .unwrap()
            .push(json!({"id":"second","kind":"movie","status":"completed"}));
        assert!(resolve_target(&work, &target()).is_err());
    }
    #[test]
    fn series_mapping_excludes_films_and_cannot_play_another_parts_episode() {
        let work = json!({"canonicalTitle":"Fixture","externalIds":{"imdbId":"tt1234567"},"installments":[
            {"id":"film","kind":"movie","position":0,"status":"completed"},
            {"id":"season-one","kind":"season","position":2,"status":"completed","episodes":[]},
            {"id":"special","kind":"special","position":3,"status":"completed"},
            {"id":"season-two","kind":"season","position":4,"status":"airing","episodes":[
                {"id":"released","number":"3","releaseState":"released"},{"id":"future","number":"4","releaseState":"upcoming"}]}
        ]});
        let mut selected = target();
        selected.installment_id = Some("season-two".into());
        selected.episode_id = Some("released".into());
        let resolved = resolve_target(&work, &selected).unwrap();
        assert_eq!(resolved.search.season, Some(2));
        assert_eq!(resolved.search.episode, Some(3));
        selected.episode_id = Some("future".into());
        assert!(resolve_target(&work, &selected).is_err());
        selected.installment_id = Some("season-one".into());
        selected.episode_id = Some("released".into());
        assert!(resolve_target(&work, &selected).is_err());
    }
    #[test]
    fn non_video_payloads_are_never_player_candidates() {
        assert!(is_video("season/episode.MKV"));
        for name in [
            "run.exe",
            "setup.sh",
            "movie.mkv.exe",
            "playlist.m3u8",
            "index.html",
            "archive.zip",
        ] {
            assert!(!is_video(name));
        }
    }
}
