use super::*;

#[test]
fn paths_and_ranges() {
    for path in ["../a", "/a", "a/../b", "a\\b", "C:a", "a//b", "a/./b"] {
        assert!(validate_path(path).is_err());
    }
    assert!(validate_path("فيلم/episode.mkv").is_ok());
    assert!(validate_range(10, 8, 2).is_ok());
    assert!(validate_range(10, 8, 3).is_err());
    assert!(validate_range(u64::MAX, u64::MAX, 1).is_err());
}

#[test]
fn store_reopens_and_rejects_future_and_corrupt() {
    let root = tempfile::tempdir().unwrap();
    let open = || {
        Engine::open_with_network(
            root.path(),
            root.path().join("media"),
            NetworkPolicy::LoopbackOnly,
        )
    };
    let engine = open().unwrap();
    assert!(engine.jobs().unwrap().is_empty());
    assert!(
        open().is_err(),
        "a second owner must not access the same job store"
    );
    drop(engine);
    drop(open().unwrap());
    let db = Connection::open(root.path().join("jobs.sqlite3")).unwrap();
    db.pragma_update(None, "user_version", 999).unwrap();
    drop(db);
    assert!(open().is_err());
    let corrupt = tempfile::tempdir().unwrap();
    std::fs::write(corrupt.path().join("jobs.sqlite3"), b"not sqlite").unwrap();
    assert!(
        Engine::open_with_network(
            corrupt.path(),
            corrupt.path().join("media"),
            NetworkPolicy::LoopbackOnly
        )
        .is_err()
    );
}

fn wait_complete(engine: &Engine, id: &TorrentId) {
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        let status = engine.status(id).unwrap();
        assert!(status.error.is_none(), "{status:?}");
        if status.complete {
            break;
        }
        assert!(Instant::now() < deadline, "completion timeout: {status:?}");
        thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn controlled_loopback_formats_selection_promotion_and_restart() {
    for version in [1, 2, 3] {
        let fixture_root = tempfile::tempdir().unwrap();
        let data: Vec<u8> = (0..65536).map(|i| (i % 251) as u8).collect();
        let fixture_dir = fixture_root.path().join("fixture");
        std::fs::create_dir(&fixture_dir).unwrap();
        std::fs::write(fixture_dir.join("movie.mp4"), &data).unwrap();
        std::fs::write(fixture_dir.join("readme.txt"), [b'x'; 32]).unwrap();
        let meta = ffi::fixture(fixture_root.path().to_str().unwrap(), version).unwrap();
        let seed_state = tempfile::tempdir().unwrap();
        let seed_media = tempfile::tempdir().unwrap();
        let seed = Engine::open_with_network(
            seed_state.path(),
            seed_media.path(),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        let id = seed.import_torrent(meta.clone()).unwrap();
        let storage = seed_media.path().join(&id.0).join("fixture");
        std::fs::create_dir_all(&storage).unwrap();
        std::fs::copy(fixture_dir.join("movie.mp4"), storage.join("movie.mp4")).unwrap();
        std::fs::copy(fixture_dir.join("readme.txt"), storage.join("readme.txt")).unwrap();
        let seed_files = seed.files(&id).unwrap();
        seed.select_download(&id, seed_files.iter().map(|f| f.index).collect())
            .unwrap();
        seed.start(&id).unwrap();
        wait_complete(&seed, &id);
        let target_state = tempfile::tempdir().unwrap();
        let target_media = tempfile::tempdir().unwrap();
        let target = Engine::open_with_network(
            target_state.path(),
            target_media.path(),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        let target_id = target.import_torrent(meta.clone()).unwrap();
        assert_eq!(id.0, target_id.0);
        assert_eq!(target.import_torrent(meta).unwrap().0, id.0);
        assert_eq!(target.jobs().unwrap().len(), 1);
        let movie = target
            .files(&id)
            .unwrap()
            .into_iter()
            .find(|f| f.path.ends_with(".mp4"))
            .unwrap();
        let lease = target.playback_lease(&id, vec![movie.index]).unwrap();
        assert!(target.status(&id).unwrap().paused);
        target.start(&id).unwrap();
        target
            .connect_loopback_peer(&id, seed.listen_port().unwrap())
            .unwrap();
        let actual = target
            .read_range(
                &id,
                movie.index,
                8193,
                32768,
                Duration::from_secs(20),
                &Cancellation::default(),
            )
            .unwrap();
        assert_eq!(actual, data[8193..8193 + 32768]);
        target.select_download(&id, vec![movie.index]).unwrap();
        drop(lease);
        wait_complete(&target, &id);
        target.pause(&id).unwrap();
        target.checkpoint().unwrap();
        drop(target);
        let restored = Engine::open_with_network(
            target_state.path(),
            target_media.path(),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        assert_eq!(restored.jobs().unwrap()[0].selected, vec![movie.index]);
        assert!(restored.status(&id).unwrap().paused);
        restored.start(&id).unwrap();
        wait_complete(&restored, &id);
        assert_eq!(
            restored
                .read_range(
                    &id,
                    movie.index,
                    0,
                    data.len(),
                    Duration::from_secs(5),
                    &Cancellation::default()
                )
                .unwrap(),
            data
        );
        let cancel = Cancellation::default();
        cancel.cancel();
        assert!(matches!(
            restored.read_range(&id, movie.index, 0, 1, Duration::from_secs(1), &cancel),
            Err(Error::Cancelled)
        ));
        drop(restored);
        drop(seed);
        std::fs::write(
            target_media.path().join(&id.0).join(&movie.path),
            vec![0u8; data.len()],
        )
        .unwrap();
        let damaged = Engine::open_with_network(
            target_state.path(),
            target_media.path(),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        damaged.start(&id).unwrap();
        assert!(matches!(
            damaged.read_range(
                &id,
                movie.index,
                0,
                1024,
                Duration::from_millis(500),
                &Cancellation::default()
            ),
            Err(Error::Timeout)
        ));
        assert!(!damaged.status(&id).unwrap().complete);
    }
}
