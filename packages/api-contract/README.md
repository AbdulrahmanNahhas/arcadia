# Local client API contract

`openapi.json` is the single versioned client contract. The initial API accepts
revocable owner Bearer sessions. It does not grant ordinary family accounts access
until their content policies are enforced. No administrator token is sent to a client.

Run `devenv shell -- pnpm --filter @nahhasio/api-contract generate` to
regenerate the TypeScript models and validated fetch client. The command formats the generated TypeScript. The generator supports this contract's
explicit object/ref/array/nullable subset and rejects unsupported model constructs.
The generated TypeScript transport validates response structure and enum values
against the same OpenAPI source. The GTK web interface parses these generated schemas after native replies. Native Rust owns
authentication/session secrets and bounded HTTP transport; only active TypeScript output is generated.

List filters combine with AND. Text searches literal title/Arabic title/aliases, so `%`
and `_` are not wildcard characters. Lists default to 24 results and are capped at 100.
Sorts use stable ID ties. Genre takes a vocabulary slug. Filter vocabulary uses
`GET /api/v1/catalog/filters`. Details include episodes, release dates, scores, warnings,
artwork, aliases, trivia, contributions and related works. Private editorial workflow,
account credentials, storage paths and job internals are not part of the client payload.

Artwork URLs are relative to the server and require the Bearer header; use an authenticated
image loader. Configure `ARCADIA_MEDIA_ROOT` for upload storage and
`ARCADIA_PUBLIC_MEDIA_ROOT` for other `/media/` files when deploying. Defaults match the
repository development storage. Serving checks registered asset IDs, canonical filesystem
containment, allowlisted image MIME and a 20 MB size limit. Missing files return 404.

Episode `releaseState` is derived from the recorded calendar date at the server's current
date. `hasMediaFile` only means a mapping exists in the catalog; it does not verify the
file, grant access to its filesystem path or promise playback. Torrent/Jellyfin playback,
provider synchronization and progress/download mutations are later contract additions.

## Public releases

`GET /api/v1/releases` requires the existing owner Bearer session and always excludes private
works. The generated exports are `ReleaseEntrySchema` / `ReleaseEntry` and
`ReleasesPageSchema` / `ReleasesPage`. `ApiClient.getReleases(query = {}, signal?)` accepts
optional `year`, `month`, `day`, `kind` (`all`, `installments`, `episodes`), `scope` (`year`, `upcoming`,
`undated`), `page` and `pageSize`. The native command is `releases` with the same query payload;
UI code must parse its reply with `ReleasesPageSchema`.

Defaults are the database's current year, `kind=all`, `scope=year`, `page=1`, `pageSize=24`.
Year is 1–9999, month 1–12, day 1–31, page 1–100000 and page size 1–100. Year/month are accepted
only in `year` scope. Day additionally requires a supplied month; omitted scope defaults to `year`.
Nonexistent calendar dates (such as February 31) match no entries. `upcoming` includes dated entries from `current_date` onward across years;
`undated` includes announced installments and undated episodes whose parent is announced or airing.
Dates come only from the selected row's recorded `release_date`, never a title year or parent date.

The page returns `items`, `total`, `page`, `pageSize`, ascending distinct actual public release
`years` (independent of filters), `days`, and the database calendar date `asOf`.
`days` is an ascending array of `{ date: "YYYY-MM-DD", count: integer }` for populated dates in
the filtered scope **before pagination**, respecting kind, year, month and selected day. Undated
results have `days: []`. A calendar overview requests a month without day and `pageSize=1` for exact
daily counts without downloading all episodes; selecting a day adds `day` for its paginated feed
(and its single-date count). Counts do not depend on the requested page or page size.
Entries sort by ascending
date (null last), work sort title, installment/episode positions, kind and UUID. Both entry types
carry their parent work/installment IDs and titles. Episode numbers remain decimal strings;
episode `status` is the parent's recorded status and episode `episodeCount` is null. Installment
`episodeCount` counts recorded episodes. Missing metadata stays null. Posters prefer installment
then work artwork and use the same registered, authenticated artwork representation. The native
adapter reconstructs poster URLs from validated UUIDs and excludes filesystem/extra artwork fields.
No passed date or release status promises playback availability. This endpoint writes nothing and
performs no provider lookups.

## Viewer state and work discussion

All four endpoints require the existing owner Bearer session. Personal writes resolve the
active linked account on the server; no client account ID or dashboard admin token is accepted.

- `GET /api/v1/works/{id}/state` returns `WorkViewerState`: `workId`, `isFavorite`, canonical
  `units`, a work `summary`, and `installments` with their own summaries.
- `PUT /api/v1/works/{id}/favorite` accepts `{ isFavorite }`. It preserves personal rating,
  notes and the existing saved-offline flag.
- `PATCH /api/v1/works/{id}/watched` accepts `{ installmentId, episodeId, isPlayed }`.
  Nullable installment/episode IDs select the whole work or installment. An episode requires
  its season's installment ID. Explicit bulk selection includes **all catalog units, including
  future units**, preserving legacy manual semantics. A movie/special is one null-episode unit;
  a season contains episode units, never a synthetic season playback row.
- Both writes return the committed `WorkViewerState`, preserve existing playback row UUIDs,
  position/duration/subtitle offset, and use a transactional manual override. Manual true and
  false remain distinguishable from automatic watched state through `playedManually`.
- `GET /api/v1/works/{id}/activity?page=1` returns `WorkActivityPage` with `workId`, `items`,
  `total`, `page`, and fixed `pageSize: 20`. Published comments/reviews from active discoverable
  authors only; stable newest-first ordering. Owners may read discussion on private works.
  Bodies are plain text; `containsSpoilers` must require explicit UI reveal. Comment `parentId`
  may refer to an entry outside the current page. Reviews may have an empty body and a real rating.

Unit state includes nullable `stateId`, `episodeId`, `durationSeconds`, `playedAt`,
`subtitleOffsetMs`, `updatedAt`, plus `installmentId`, `isReleased`, `positionSeconds`,
`isPlayed`, `playedManually`. An unrecorded canonical unit has zero position, false watched/manual
flags and null row metadata. These defaults are response data, not inserted playback records.

Summaries expose `catalogUnits`, `releasedUnits`, `watchedReleasedUnits`, `isFullyWatched`, and
`watchState` (`unwatched`, `in-progress`, `watched`). Empty works/seasons are not fully watched.
Only released units contribute to full completion. Browse and state share the same rule:
an explicit unit release date must have passed; absent dates fall back to installment release
status `completed`. Episodes count only under seasons. A future manual watched choice is still
returned and may produce `in-progress`; it never inflates released-unit completion counts.
Release completion, watched completion, saved metadata and video availability are independent.

Native gateway methods: `workState(id, signal?)`, `setFavorite(workId, isFavorite)`,
`setWatched(workId, { installmentId?, episodeId?, isPlayed })`, and
`workActivity(id, page = 1, signal?)`. Use returned state to replace the account-scoped work-state
query, then invalidate browse/facets/recommendations affected by watched/favorite changes.
Clear personal-state queries on logout/account changes. Do not claim downloaded bytes from saved flags.

`pnpm --filter @nahhasio/api-contract test` runs SQL-free generated-schema/transport tests.
No database mutation test is part of this package's default test command.

`apps/server/tests/client-smoke.mjs` exercises authorized API boundaries against an
isolated restored server on port 23104. Use only its dedicated fixture session;
`NAHHASIO_TEST_REVOKE=1` also revokes that session at the end. SQL query verification runs read-only.

## Work-detail field inventory

The selected-work endpoint returns the following recorded information. Arrays are
present even when empty; missing scalar data remains null rather than being invented.

| Area                          | Returned fields                                                                                                                                                                                                               | Ownership and limits                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work identity and description | Stable UUID, canonical/Arabic/sort titles, summary, release year, format, aliases with language/script/preference, ordered trivia                                                                                             | Existing catalog identity is preserved.                                                                                                                       |
| Editorial information         | Content warnings, analysis notes, curator notes, quality score, audience, age, three risk levels                                                                                                                              | This first API is owner-authorized. Workflow flags, private administration state, credentials and audit information are excluded.                             |
| Metadata                      | Created/updated/verified timestamps, TMDB/IMDb/AniList/MAL IDs, free-form provider references with IDs and URLs                                                                                                               | Provenance objects and verifying account IDs remain administrative.                                                                                           |
| Taxonomy                      | Genres, tones, tags and countries with stable IDs, slugs, English/Arabic labels and descriptions                                                                                                                              | Attached values remain visible even if their vocabulary entry was later deactivated.                                                                          |
| Planets                       | ID, slug, Arabic/English names, icon, description, recorded colors, featured rank                                                                                                                                             | Colors are stored metadata; each client decides their accessible presentation.                                                                                |
| People and organizations      | Entity ID/name/kind/description, aliases, artwork, contribution ordering/primary flag, role ID/slug/bilingual labels/descriptions                                                                                             | Nested data belongs to the selected work; no entity-directory fetch is required.                                                                              |
| Relations                     | Relation ID, related-work ID and titles, kind, incoming/outgoing direction, notes                                                                                                                                             | Direction preserves the original catalog relationship.                                                                                                        |
| Awards                        | Recognition ID, installment association, organization/category/year, winner/nominee, feature flag, source URL, notes/order; linked organization/category/ceremony descriptions and dates                                      | Old free-form recognition labels are preserved alongside structured records. Organization logo filesystem paths are not published.                            |
| Artwork                       | Registered asset ID/authenticated URL, role/primary flag, MIME, dimensions, byte size, SHA-256, original filename, focal coordinates                                                                                          | Work, installment, episode and contributor artwork have the same typed representation. Filesystem paths stay private.                                         |
| Installments                  | Stable ID, kind/order/title/summary, release date, runtime, recorded release status, derived date state, provider IDs/references, timestamps, artwork, scores, effective classification and nullable classification overrides | Effective classification falls back to the work. All six criterion scores remain independent nullable values, with their update timestamp.                    |
| Episodes                      | Stable ID, decimal episode number, order/title/summary, release date, runtime, derived date state, timestamps, artwork, effective classification                                                                              | The schema has no episode-specific warnings, analysis, score or provider-ID columns. These remain inherited from work/installment instead of fabricated.      |
| Registered media              | Media-file ID, recorded duration, track ID/kind/index/language/codec/title/default/forced, Jellyfin-link flag                                                                                                                 | Workflows can inspect recorded availability; file presence and playback need a resolver. No filesystem path, Jellyfin credentials or playback URL is exposed. |

`releaseState` distinguishes unknown dates, upcoming dates and dates that have passed;
it is independent of registered file availability. `classificationOverrides` records
explicit installment choices while `classification` exposes the effective values an
episode inherits. Playback and download actions remain disabled until an authorized
resolver and transfer implementation are connected.
