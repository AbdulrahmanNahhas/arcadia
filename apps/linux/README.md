# Nahhasio Linux client

First Compose Desktop/JVM client. Requires JDK 21, a graphical Linux session, and `mpv`
on PATH. The repository devenv provides these tools.

```sh
devenv shell -- nahhasio-client
devenv shell -- apps/linux/gradlew -p apps/linux :composeApp:compileKotlin
```

`devenv up` starts PostgreSQL, the Rust API, the dashboard and this desktop client.
Use `devenv up postgres server web` when you only want the backend/dashboard.
If those services are already running, use the client-only command above rather than
starting a second copy. The first Gradle run may need to build before the window opens.

The server must expose the versioned `/api/v1` catalog and auth endpoints. Use a real
existing catalog account. Sessions stay in memory and are removed on logout; secure
desktop credential persistence is future work. HTTP is accepted only for loopback;
remote connections require HTTPS to protect passwords and bearer sessions.

Implemented: owner login, paginated search, filters/sorting, authorized poster loading,
responsive library browsing, a cinematic work page with six tabs for full catalog details,
installment/episode selection and local file playback in an external mpv window.
mpv handles subtitles, audio tracks, seeking and fullscreen. Player commands use a
private temporary Unix socket; closing the client terminates its player.

The selected local file is not registered as the work's media file. Streaming,
Jellyfin source resolution, torrents, download queues, saved work packages and progress
sync are pending. Their controls are disabled. The client cannot administer the server.

Source is split by authentication, API transport, library screens and desktop playback.
Generated contract models belong under `generated/` and are regenerated from the shared
OpenAPI contract. Linux packaging tasks exist, but distributable packages require separate
runtime verification on the target Fedora machine.

For an isolated API integration check, run the generated JAR with `--smoke` and provide
one JSON `LoginRequest` on standard input. Set `NAHHASIO_CLIENT_SERVER` to the disposable
server. The check logs in, decodes list/detail/filter responses with generated Kotlin
models, downloads authorized artwork, and logs out. It never changes catalog records.
Do not place credentials in command arguments or shell history.

The `--preview /absolute/output.png` mode renders app-owned responsive snapshots beside
that output location, using actual library and Arcane data. It verifies tab selection,
episode selection and RTL keyboard tab navigation through Compose semantics at widths
1440/1024/640/480 and height600; additional desktop previews use1440×900. Input credentials
use the same private standard-input mechanism. Details and verification limits are in
[DESIGN.md](./DESIGN.md).
