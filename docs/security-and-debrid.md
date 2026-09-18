# Security model: torrents, containers, and debrid

> Written 2026-09-18 for the v0.3.5 self-hosting work. Read alongside
> [`player-torrent-roadmap.md`](./player-torrent-roadmap.md) (how playback is built) and the
> "Self-hosting on Fedora Atomic" section of the README (how the server is deployed). Claims about
> third-party services (Real-Debrid) are as of writing — re-check their terms before relying on them.

## 1. Torrents and malware — what the actual risk is

A torrent delivers bytes; it never executes anything. For Arcadia the bytes are a single video
file, and the only code that ever *interprets* them is the demuxer/decoder stack inside libmpv
(ffmpeg, libass for subtitles). So the risk splits into three very different things:

| Risk | Real? | How Arcadia handles it |
| --- | --- | --- |
| **The "video" is not a video** — a `.exe`, `.lnk`, `.scr`, `.zip`, or an `.mkv` that is really an installer. Classic on public trackers. | Yes, the common one | The desktop engine only ever fetches the **one file** the addon pointed at (`only_files: [file_idx]`), never a whole pack. Before a byte is fetched, the chosen file's extension is checked against an allowlist (`mkv mp4 webm avi mov m4v ts`, `src-tauri/src/torrent/mod.rs`); anything else is rejected and reported, for streams and downloads alike. Nothing in the app opens, extracts, or runs a downloaded file — mpv reads it, that's all. |
| **Parser bugs** — a crafted container/codec/subtitle payload exploiting a CVE in ffmpeg or libass. | Rare, but the only way a *video* can hurt you | Keep libmpv/ffmpeg current (Fedora/Nix updates — the AppImage links the system libmpv on purpose). libmpv runs with `load-scripts=no`, `ytdl=no`, `osc=no`, `input-default-bindings=no`, so no Lua/JS or youtube-dl path exists; subtitles are plain text `.srt`/`.ass` written to the app cache and loaded by path. |
| **Swarm exposure** — your IP is visible to peers; peers could send garbage. | Visibility yes; garbage no | Every BitTorrent piece is SHA-1 verified against the torrent's metadata before it is written, so a hostile peer cannot inject data — it can only waste time, and the engine drops zero-throughput candidates. **Uploading is disabled** (`DISABLE_UPLOAD`, `librqbit` `disable-upload` feature), so the client never seeds; streamed data is deleted when playback stops unless it was explicitly downloaded. Whether being visible in a swarm is acceptable at all is a legal/ISP question for the family, not a malware one — debrid (§3) removes it entirely. |

What it does **not** do, deliberately: scan files with an antivirus (a video file cannot be
"cleaned"; the allowlist plus an up-to-date decoder is the real control), or filter by codec.

## 2. What the container protects — and what it does not

The server pieces — PostgreSQL, the Hono API, the static web copy — run in **rootless Podman**
on the Fedora Atomic box. The torrent client and mpv do **not** run there. They live in the
desktop app on whichever machine is watching; the API's only contact with the torrent world is
an HTTPS JSON call to the Stremio addon that returns info hashes. So:

- **A compromised API/DB container cannot reach the host.** Rootless Podman maps container
  `root` to your unprivileged user and everything else to a subuid range; there is no daemon
  running as root. With SELinux enforcing (Fedora's default) each bind mount carries a `:Z`
  label, so the container can touch exactly the directories it was given (`~/arcadia/media`,
  the Postgres volume, the backups folder) and nothing else on disk. No host network namespace
  is shared; only the published ports (23101 API, 23180 web) are reachable, and only on the LAN.
- **Podman images are pulled, not built, on the box** (GHCR, built by CI from the repo), so no
  Node toolchain or repo checkout exists on the server, which shrinks what an attacker could use.
- **It does not sandbox the player.** The desktop app has to reach the GPU, the display, and the
  filesystem it downloads into, so it runs as a normal user process. The equivalent step for the
  client would be a Flatpak/bubblewrap sandbox for the AppImage — out of scope for v0.3.5, noted
  so nobody assumes Podman covers it.
- **Secrets stay out of images.** `BETTER_AUTH_SECRET`, the Postgres password, TMDB/OpenSubtitles
  keys, and any debrid key live in `~/.config/arcadia/arcadia.env` on the box (mode `0600`), read
  by the units at start. The desktop app never sees them; it only sees the API.

## 3. Debrid (Real-Debrid) — how it works and how it fits

A debrid service is a paid HTTP cache in front of BitTorrent. You hand it an info hash (or
magnet); if the torrent is already in its cache — the popular ones always are — it answers with
a plain **HTTPS download link** to the file on its own servers. Your client then downloads from
that link like any web download: no peers, no DHT, no uploading, and your IP never joins a swarm.
If the torrent is not cached, the service downloads it on its side first and you wait.

### Integration with Arcadia — mostly configuration

Torrentio has debrid support built in: appending `realdebrid=<API key>` (or `alldebrid=`,
`premiumize=`) to the addon config segment makes the same `/stream/...` endpoint return streams
carrying a direct `url` instead of an `infoHash`. Arcadia already handles that shape end to end:

- `apps/api/src/integrations/torrent-source.ts` parses `url`-bearing streams as `direct`
  candidates and ranks them above every torrent.
- `src-tauri/src/torrent/mod.rs` `start_stream` returns a direct URL untouched and mpv plays it
  over HTTPS; no torrent session is started.
- `apps/web/src/features/library/offline-store.ts` refuses to persist direct URLs (they expire
  and embed the key), so nothing leaks into the offline store.

So enabling it today is one env change on the server:

```env
ARCADIA_STREAM_ADDON_CONFIG=qualityfilter=cam,480p|realdebrid=YOUR_KEY
```

Two caveats, then the roadmap's Phase 6 for the nicer version:

- Torrentio's resolved `url` embeds the key in its path, so it reaches the family's clients.
  On a LAN-only deployment behind an authenticated API that is acceptable; it is not acceptable
  if the API is ever exposed publicly. Phase 6 (per-user key in the OS keychain, resolved
  through the API) is the fix if that day comes.
- Torrentio only returns cached results for debrid; an uncached torrent shows as unavailable
  rather than "downloading on the debrid side". Fine for a family archive of well-known titles.

### Does debrid solve the security concerns?

- **P2P exposure: yes, completely.** No swarm, no peers, no upload, no port to open, and the
  transfer is TLS from one known host.
- **File content: no change.** The bytes are the same bytes the swarm would have delivered;
  the decoder is the same decoder. The extension allowlist and up-to-date libmpv remain the
  controls. (A debrid provider is not an antivirus and does not claim to be.)
- **Legal posture: better.** The family fetches a file from a paid service over HTTPS instead of
  distributing pieces to strangers. Whether that matters is a local question, not a technical one.

### "No multi-IP" — what it means in practice

Real-Debrid's terms allow one account to be used from **one public IP address at a time**. It is
about IPs, not devices:

- Two laptops, a TV box, and a phone all on the **same home Wi-Fi** share one public IP (the
  router's). They can stream different films **at the same time** on one subscription without
  tripping anything.
- The same account used **simultaneously** from two different public IPs — home Wi-Fi *and* a
  phone on cellular, or one device on a VPN while another is not — is what the rule forbids.
  RD detects it and temporarily locks downloads (typically until the next day) and repeated
  offenses can end the account.
- Switching IPs *sequentially* is fine (home in the evening, hotel the next day); it is the
  overlap that matters. Note that the desktop app's stream server is loopback-only and playback
  is direct from RD's CDN to the watching machine, so every family device counts as its own
  client under this rule — again fine as long as they sit behind the same router.

Re-check [real-debrid.com/terms](https://real-debrid.com/terms) before buying; the rule has been
stable for years but the enforcement details (lock duration, VPN handling) are theirs to change.
