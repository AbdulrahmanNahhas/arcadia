//! Main-thread attachment of asynchronous, native-owned media results.
use crate::{
    bridge::Error,
    media::{Command, Media, Ready},
    player::Player,
};
use serde_json::{Value, json};
use std::{rc::Rc, sync::Arc};

pub async fn execute(
    player: Rc<Player>,
    media: Arc<Media>,
    runtime: Arc<tokio::runtime::Runtime>,
    command: Command,
) -> Result<Value, Error> {
    if let Some(id) = command.session() {
        player.require_session(id)?;
    }
    let pause_requested = matches!(&command, Command::Pause { .. });
    match command {
        Command::Search { session_id, target } => {
            let result = runtime
                .spawn(async move {
                    media
                        .search(session_id.clone(), target)
                        .await
                        .map(|sources| (session_id, sources))
                })
                .await
                .map_err(|_| interrupted())??;
            player.set_target(&result.0, result.1.target.clone())?;
            serde_json::to_value(result.1).map_err(|_| interrupted())
        }
        Command::Play {
            session_id,
            source_id,
            file_index,
        } => {
            player.loading(&session_id, true, None)?;
            let expected = session_id.clone();
            let result = runtime
                .spawn(async move { media.play(&session_id, &source_id, file_index).await })
                .await
                .map_err(|_| interrupted())?;
            player.require_session(&expected)?;
            match result {
                Ok(Ready::Choices { files, target }) => {
                    player.loading(&expected, false, None)?;
                    player.set_target(&expected, target.clone())?;
                    Ok(json!({"mode":"choose_file","files":files,"target":target}))
                }
                Ok(Ready::Playing { gateway, target }) => {
                    player.play_torrent(&expected, target, gateway)?;
                    Ok(json!({"mode":"playing","snapshot":player.snapshot()}))
                }
                Err(error) => {
                    player.loading(&expected, false, Some(error.message.clone()))?;
                    Err(error)
                }
            }
        }
        Command::Keep { session_id } => {
            let (id, file) = player.download_target(&session_id)?;
            runtime
                .spawn(async move { media.keep(id, file).await })
                .await
                .map_err(|_| interrupted())??;
            Ok(json!({"ok":true}))
        }
        Command::Jobs {} => runtime
            .spawn(async move { media.jobs().await })
            .await
            .map_err(|_| interrupted())?,
        Command::Pause { id } | Command::Resume { id } => {
            let paused = pause_requested;
            runtime
                .spawn(async move { media.set_paused(id, paused).await })
                .await
                .map_err(|_| interrupted())??;
            Ok(json!({"ok":true}))
        }
    }
}
fn interrupted() -> Error {
    Error::new("transfer", "انقطعت عملية تجهيز الفيديو.")
}
