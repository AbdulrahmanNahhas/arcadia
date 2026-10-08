# Local client API contract

`openapi.json` is the single versioned client contract. The initial API accepts
revocable owner Bearer sessions. It does not grant ordinary family accounts access
until their content policies are enforced. No administrator token is sent to a client.

Run `devenv shell -- pnpm --filter @nahhasio/api-contract generate` to
regenerate the TypeScript models/fetch client and Kotlin serializable models. The command formats the generated TypeScript. The generator supports this contract's
explicit object/ref/array/nullable subset and rejects unsupported model constructs.
The generated TypeScript transport validates response structure and enum values
against the same OpenAPI source. Kotlin transport decodes the generated serializable
models. Kotlin screens and transport behavior remain owned by the client.

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
