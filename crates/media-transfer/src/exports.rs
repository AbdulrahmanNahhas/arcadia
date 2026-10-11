//! Durable export intent; copies run on the caller's blocking executor, not the owner queue.
use super::*;
use std::io::Write;

impl Owner {
    pub(super) fn job_root(&self, id: &str) -> Result<PathBuf> {
        let root: String =
            self.db
                .query_row("SELECT payload_root FROM jobs WHERE id=?1", [id], |row| {
                    row.get(0)
                })?;
        let root = PathBuf::from(root);
        if root != self.root && root != self.payload_root {
            return Err(Error::Invalid("unrecognized payload root".into()));
        }
        reject_symlinks(&root)?;
        Ok(root)
    }
}

/// A single safe directory name, preserving readable Unicode work titles.
pub fn work_directory(title: &str) -> String {
    let name: String = title
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '/' | '\\' | ':') {
                '_'
            } else {
                c
            }
        })
        .take(120)
        .collect();
    let name = name.trim().trim_matches('.').trim();
    if name.is_empty() {
        "Video".into()
    } else {
        name.into()
    }
}

impl Engine {
    pub fn keep_export(&self, id: &TorrentId, file: u32, videos: &Path, title: &str) -> Result<()> {
        create_private_root(videos)?;
        let folder = videos.join(work_directory(title));
        create_private_root(&folder)?;
        let folder = folder.canonicalize()?;
        let entry = self
            .files(id)?
            .into_iter()
            .find(|entry| entry.index == file)
            .ok_or_else(|| Error::Invalid("file".into()))?;
        let filename = Path::new(&entry.path)
            .file_name()
            .ok_or_else(|| Error::Invalid("filename".into()))?;
        let destination = folder.join(filename);
        reject_symlinks(&destination)?;
        let owned_id = id.0.clone();
        let destination = destination
            .to_str()
            .ok_or_else(|| Error::Invalid("destination encoding".into()))?
            .to_owned();
        self.call(move |owner| {
            let previous: Option<String> = owner
                .db
                .query_row(
                    "SELECT destination FROM exports WHERE id=?1 AND file=?2",
                    params![owned_id, file],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(previous) = previous {
                if previous != destination {
                    return Err(Error::Invalid("export destination changed".into()));
                }
            } else {
                if Path::new(&destination).exists() {
                    return Err(Error::Invalid(
                        "download filename already exists; nothing was overwritten".into(),
                    ));
                }
                owner.db.execute(
                    "INSERT INTO exports(id,file,destination) VALUES(?1,?2,?3)",
                    params![owned_id, file, destination],
                )?;
            }
            Ok(())
        })?;
        self.keep_file(id, file)
    }

    /// Publish only whole verified files. Never overwrite a destination, including on restart.
    pub fn export_completed(&self) -> Result<()> {
        let plans = self.call(|owner| {
            let mut stmt = owner
                .db
                .prepare("SELECT id,file,destination FROM exports WHERE done=0")?;
            let plans = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, u32>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                })?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            Ok(plans)
        })?;
        let mut failure = None;
        for (id, file, destination) in plans {
            if let Err(error) = self.export_one(id, file, PathBuf::from(destination)) {
                failure = Some(error);
            }
        }
        failure.map_or(Ok(()), Err)
    }
    fn export_one(&self, id: String, file: u32, destination: PathBuf) -> Result<()> {
        let reader_id = id.clone();
        let source = self.call(move |owner| {
            if !owner.selection(&reader_id)?.contains(&file)
                || !owner.native.file_complete(&reader_id, file)?
            {
                return Ok(None);
            }
            let entry = owner
                .files(&reader_id)?
                .into_iter()
                .find(|entry| entry.index == file)
                .ok_or_else(|| Error::Invalid("file".into()))?;
            Ok(Some((
                owner
                    .job_root(&reader_id)?
                    .join(&reader_id)
                    .join(entry.path),
                entry.size,
            )))
        })?;
        let Some((source, size)) = source else {
            return Ok(());
        };
        reject_symlinks(&source)?;
        reject_hardlinks(&source)?;
        reject_symlinks(&destination)?;
        let parent = destination
            .parent()
            .ok_or_else(|| Error::Invalid("destination".into()))?;
        create_private_root(parent)?;
        let temp = parent.join(format!(".nahhasio-{id}-{file}.partial"));
        // A leftover private partial is ours, but refuse symlinks/hardlinks before retrying.
        reject_symlinks(&temp)?;
        reject_hardlinks(&temp)?;
        if temp.exists() {
            std::fs::remove_file(&temp)?;
        }
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        let result = (|| {
            let torrent = TorrentId(id.clone());
            let cancel = Cancellation::default();
            let mut offset = 0;
            while offset < size {
                let length = (size - offset).min(MAX_RANGE as u64) as usize;
                let bytes = self.read_range(
                    &torrent,
                    file,
                    offset,
                    length,
                    Duration::from_secs(10),
                    &cancel,
                )?;
                output.write_all(&bytes)?;
                offset += bytes.len() as u64;
            }
            output.flush()?;
            output.sync_all()?;
            // Atomic no-clobber publication on the same filesystem; no link to torrent storage.
            std::fs::hard_link(&temp, &destination)?;
            std::fs::File::open(parent)?.sync_all()?;
            self.call(move |owner| {
                owner.db.execute(
                    "UPDATE exports SET done=1 WHERE id=?1 AND file=?2",
                    params![id, file],
                )?;
                Ok(())
            })
        })();
        let _ = std::fs::remove_file(temp);
        result
    }
}

#[cfg(test)]
mod tests {
    use super::work_directory;
    #[test]
    fn readable_bounded_folder_names() {
        assert_eq!(
            work_directory("Frieren Beyond Journey's End"),
            "Frieren Beyond Journey's End"
        );
        assert_eq!(work_directory("../a/b\\c:"), "_a_b_c_");
        assert_eq!(work_directory(".."), "Video");
        assert_eq!(work_directory(" أوشي نو كو "), "أوشي نو كو");
    }
}
