use percent_encoding::{AsciiSet, CONTROLS, utf8_percent_encode};

/// Everything outside the unreserved set gets encoded. `dn` is a release filename (spaces,
/// brackets, apostrophes) and `tr` is a full URL (`://`, `/`), so both would otherwise break the
/// magnet URI — this is the "you must URL-encode them" note in the roadmap's magnet section.
const MAGNET_VALUE: &AsciiSet = &CONTROLS
  .add(b' ')
  .add(b'"')
  .add(b'#')
  .add(b'%')
  .add(b'&')
  .add(b'\'')
  .add(b'+')
  .add(b'/')
  .add(b':')
  .add(b'<')
  .add(b'=')
  .add(b'>')
  .add(b'?')
  .add(b'@')
  .add(b'[')
  .add(b'\\')
  .add(b']')
  .add(b'^')
  .add(b'`')
  .add(b'{')
  .add(b'|')
  .add(b'}');

/// Builds the magnet the addon's candidate describes.
///
/// Every tracker becomes its own `&tr=`. Dropping them is not a cosmetic loss: without a tracker
/// list, peer discovery falls back to DHT alone and start-up is slow or fails outright.
pub fn build_magnet(info_hash: &str, display_name: Option<&str>, trackers: &[String]) -> String {
  let mut magnet = format!("magnet:?xt=urn:btih:{}", info_hash.to_lowercase());
  if let Some(name) = display_name.filter(|name| !name.is_empty()) {
    magnet.push_str("&dn=");
    magnet.push_str(&utf8_percent_encode(name, MAGNET_VALUE).to_string());
  }
  for tracker in trackers {
    if tracker.is_empty() {
      continue;
    }
    magnet.push_str("&tr=");
    magnet.push_str(&utf8_percent_encode(tracker, MAGNET_VALUE).to_string());
  }
  magnet
}

#[cfg(test)]
mod tests {
  use super::build_magnet;

  #[test]
  fn encodes_the_display_name_and_every_tracker() {
    let magnet = build_magnet(
      "A1B2C3D4E5F60718293A4B5C6D7E8F9021324354",
      Some("The Matrix (1999) [1080p].mkv"),
      &[
        "udp://tracker.opentrackr.org:1337/announce".to_string(),
        "http://tracker.openbittorrent.com:80/announce".to_string(),
      ],
    );
    assert_eq!(
      magnet,
      "magnet:?xt=urn:btih:a1b2c3d4e5f60718293a4b5c6d7e8f9021324354\
             &dn=The%20Matrix%20(1999)%20%5B1080p%5D.mkv\
             &tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce\
             &tr=http%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce"
    );
  }

  #[test]
  fn omits_the_display_name_when_the_addon_did_not_send_one() {
    let magnet = build_magnet("a".repeat(40).as_str(), None, &[]);
    assert_eq!(magnet, format!("magnet:?xt=urn:btih:{}", "a".repeat(40)));
  }

  #[test]
  fn skips_empty_tracker_entries_rather_than_emitting_a_bare_tr() {
    let magnet = build_magnet("b".repeat(40).as_str(), None, &[String::new()]);
    assert!(!magnet.contains("&tr="));
  }
}
