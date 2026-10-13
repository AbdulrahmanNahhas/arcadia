# Client administration migration

Aqua approved feature-by-feature migration on 2026-10-13 and requested lean verification:
compile/static checks at implementation checkpoints, with the comprehensive browser/native/API
regression after the six migration areas are finished. Do not repeatedly run those suites for
small changes. Database mutation verification still requires disposable restored databases.

## Sequence and status

| Area | Current status |
| --- | --- |
| Shared admin foundation | Session middleware and fixed typed catalog API implemented; future mutations follow existing transactional/audit conventions |
| Works management | Catalog, core work form, selective bulk form and JSON core-document editor implemented; structure/linked editing pending |
| Artwork/providers | Existing read artwork reused; upload, search/import and library administration pending |
| Other catalog administration | Prepared routes; editing pending |
| Advanced data tools | Core work JSON/bulk implemented; full structural documents, maintenance, revisions/restore and schema/table tools pending |
| Server administration/retirement | Prepared routes; existing services pending migration; retire web only after parity |

## First slice: foundation and Works catalog

- `GET /api/v1/admin/works` requires a current PostgreSQL-backed administrator session and
  active account. It is separate from the legacy debug/private-token database bridge and
  is usable by a deployed Rust server. Permissions are rechecked on every request; UI access
  checks do not authorize the endpoint. The response is private/non-cacheable (`no-store`).
- Strict query parsing, bound SQL parameters, fixed allowlisted sorts and maximum 100-row
  pagination. The desktop requests 30 rows. Counts and rows share one SQL snapshot.
- Literal title/Arabic-title/alias search; production format, movie/series structure, editorial
  workflow, public/private visibility and missing poster/summary/Arabic name/structure filters.
  Default administrative visibility includes public/private and all workflow states.
- Real title IDs, assigned poster IDs, workflow state, installment/episode counts and update
  dates. These are administrative records, independently of viewer-specific watched filters.
- One generated OpenAPI contract and fixed `adminWorks` native command. Native bearer secrets
  and server credentials never enter React. No arbitrary URL/table/SQL bridge was added.
- Typed `/admin/works` route with URL-owned filters/page. Query keys include user identity and
  every filter; requests use the existing cancellation boundary. Search has a local unsubmitted
  draft. Clearing/changing filters resets pagination. The table has pending/error/empty states,
  refresh, bounded pagination and native links to the existing work detail page.
- Preserve the reviewed Base UI Maia/Mist/Sky desktop design. Use existing official Select,
  Field, InputGroup, Table, Badge, Button, Skeleton and Empty components and Tailwind utilities.
  Work creation is visibly disabled; editing is the next slice, not a completed feature here.

## Data and deployment boundaries

No live data changes, schema migration, startup seed/import or account provisioning.
Keep the website/legacy API services while their editor/provider/maintenance consumers remain.
The pending release/calendar/episode and migration-file changes were preserved; they are not
part of this migration slice. API-contract generation retains their existing additions.

Future mutations must authorize the operation, validate a typed payload, explicitly open a
read-write transaction, recheck ownership/permission where required, detect stale revisions,
record the existing audit/recovery information, and invalidate only related client queries.
Artwork/provider credentials and persistent media paths remain server-owned for Fedora/Podman.
Client-local downloads remain a separate workflow.

## Verification policy and evidence

This slice uses Linux UI TypeScript/production build, affected Rust compilation and lint/format
checks. No browser, native UI, unit or database integration suites were run for this slice.
These checks establish compilation/static consistency, not runtime SQL, permission or UX acceptance.
Final consolidated coverage must include admin/member/expired/demoted sessions, every filter/sort,
matching counts, URL/history/pagination, narrow/RTL/keyboard behavior, artwork, stale edits,
transaction rollback, audit/restore and both browser and freshly packaged native client behavior.

Next slice: core work editor and its session-authorized document read/review/save API, preserving
existing document revisions and review-before-save semantics before enabling editing controls.

## Second slice: core work, bulk and JSON editors

Aqua requested the work editor after reviewing/revising the catalog layout, followed by bulk
and JSON editing. Preserve the compact table/poster design, page selection, and simplified
admin shell; do not restore the previous large admin header.

- Clicking a work now opens `/admin/works/<id>`. Page selection exposes **تحرير جماعي** and
  **JSON**. Direct `/admin/json` without a selection guides the user back to Works.
- One reusable workspace supports a core-work form, explicit-field bulk form and JSON mode.
  Editable fields: canonical/Arabic/sort titles, year, production type, workflow, visibility,
  audience, age, three risk levels, summary, warnings, analysis and curator notes.
- Bulk editing changes only explicitly selected fields; each untouched value remains specific
  to its original work. Mixed values are labelled. Editing a field selects it for application.
- JSON supports formatting/validation, file import, copy, field/enum reference and the same
  before/after review. IDs/revision tokens and selection membership are immutable. Maximum
  30 selected works, 2 MiB JSON text/import, 4 MiB server request bodies.
- API: GET work document, POST batch read/review/save. Schema is in the existing OpenAPI owner;
  clients validate generated models. Read/review operations are read-only. Review proofs use
  HMAC-SHA256, bind exact documents to the administrator account, expire in ten minutes and
  are invalidated by a server restart. Draft changes require a new review.
- Save locks/rechecks the active administrator session and account inside a read-write
  transaction, locks all title rows in deterministic order, verifies revisions for the complete
  batch before any updates, and commits all changes/audit rows together. SQL columns are a
  fixed server-owned allowlist. Stale or invalid signed drafts reject the entire save.
- Existing `audit_logs` retain full before/after title rows and actor ownership. Existing
  `editorial_revisions` retain numbered after snapshots and change data. No new migration,
  revision tree, startup seed or direct CLI write was introduced.
- Native commands have fixed destinations. Existing commands retain their 16 KiB request and
  2 MiB response bounds; document review/save have a bounded 4 MiB request allowance and
  document commands a 16 MiB response cap. Native diagnostic input uses the same bounded
  parser; no origin/CSP/session guards were bypassed.
- The workspace protects unsaved navigation with a controlled dialog and before-unload guard,
  preserves drafts on conflicts/errors, blocks duplicate submissions, and invalidates the
  affected work/catalog caches after saves.

This is **core work metadata editing**, not full website-editor parity. Creation, structural
editing/deletion/reordering, reference relationships, awards/scores, artwork and provider-ID
editing remain pending. Those owned records and playback/history links are never replaced by
these core documents. No live data was edited or schema migration applied during implementation.

Verification follows Aqua's lean policy: UI TypeScript/production build, generated contract,
scoped lint/format and affected Rust compilation/Clippy. No mutation, browser/native UI or
integration suites were run. A full lint attempt encountered an unrelated unused
`DrawerDescription` import in concurrent calendar work; that file was left to its owner.
Runtime write correctness and native keyboard/visual acceptance remain for the consolidated
restored-database/native/browser pass. Compilation is not that acceptance evidence.

Next: extend this same document/review/save flow to installments, episodes and linked catalog
records with ownership checks, ordering and explicit deletion-link protection; then artwork and
provider workflows. Expand JSON to those typed structures instead of allowing raw table writes.


## Third slice: complete work workspace (supersedes the minimal editor)

Aqua requested the website work editor's capabilities and tab structure, preserving the reviewed
black desktop palette, components and RTL layout. The minimal desktop editor components were
removed. Works now opens the complete workspace, with a compact artwork/title/status/score
header, view-work action, six tabs and a sticky JSON/discard/review action bar:

- Identity: original/Arabic titles, release year, format, alternative names, synopsis and trivia.
- Structure: installments and episodes, ordering, dates, metadata, installment overrides and six
  score criteria; guarded episode deletion retains the existing linked-data checks. Whole
  installment deletion remains deliberately rejected by the existing preservation rules.
- Indexing: catalog vocabularies and people/studio credits with searchable database references.
- Editorial: audience, age, three content risks, publication workflow and editorial notes.
- Images/references: registered posters/backgrounds/logos, installment posters, local upload,
  TMDB/Fanart/AniList searches, provider IDs and title relations. Remote previews are fetched
  by the authenticated server from fixed HTTPS provider hosts; registered images use the
  contained native artwork endpoint. Upload registers an asset immediately; work assignment
  is part of the reviewed draft/save.
- Awards: database-backed organizations/categories/ceremonies and recognition editing.

New-work creation uses the same full workspace/review service. Bulk and JSON routes use the
complete document workspace with field groups/presets, installment/episode scopes, hidden-field
preservation, immutable selected identities, structured cards/tree editing and lazy CodeMirror
JSON (syntax errors, completion, folding, search, format/minify, import/export/copy). Draft JSON
is a dialog in the work workspace. Unsaved navigation/import/reset use controlled desktop
confirmation dialogs; preparation/save blocks duplicate actions and invalidates affected caches.

### Preserved server logic and deployment boundary

The canonical WorkDocument schema, projection and JSON model now live in `packages/contracts`.
The existing full website reconciliation service moved to `packages/cli/src/editor/service.ts`;
the website reexports it. This retains structural identity/ownership checks, hidden-data
preservation, reference validation, episode deletion guards, rollback rehearsal and atomic save
instead of introducing another full reconciliation implementation.

The desktop invokes `/api/v1/admin/editor` through one fixed native gateway operation. Rust
checks an active admin session and starts a private fixed Node/tsx worker, with bounded stdin,
stdout, concurrency and runtime. It has no HTTP listener, arbitrary SQL interface, client-owned
credentials or website process dependency. The worker also validates operation payloads and
admin identity. Save locks/rechecks session/account and work roots, checks full-document
revisions, validates the reviewed result and commits the batch/audit together. Review proofs are
signed, actor-bound, expire after twenty minutes and become invalid when the Rust server restarts.
Full document revision snapshots use `editorial_revisions.entity_type = work_documents`, distinct
from raw-title revision snapshots. No schema migration or catalog mutation was applied here.

**Temporary production dependency:** the server still needs Node, tsx and the shared catalog/API
libraries/source tree for these operations. Fedora/Podman packaging must include them and the
configured persistent PostgreSQL/artwork volumes; `NAHHASIO_EDITOR_ROOT` can select the packaged
trusted repository root. This slice is not a full Rust port and does not authorize removing the
legacy shared libraries or website before the remaining workflow parity/review is complete.

CodeMirror uses a fresh per-HTML native style nonce. Script/origin/session guards and Base UI's
existing disabled dynamic styles remain intact. Large editor requests have a 16 MiB cap, responses
32 MiB; other native commands retain their small default request limit. The native editor HTTP
request timeout covers the server's bounded worker duration.

### Actual checks

- Desktop TypeScript and production Vite build passed; structure and CodeMirror are lazy chunks.
- Shared CLI/service TypeScript and website TypeScript passed after extraction.
- Scoped Oxlint passed; affected source formatting passed.
- Rust server/Linux cargo check, scoped Clippy with warnings rejected, and native cargo build passed.
- The running server was restarted. One authenticated, read-only full-document request succeeded
  with a 64-character revision and nested installments/episodes. The temporary session was logged
  out (HTTP 204); the small Python harness initially tried to parse that empty response as JSON.
- Closed the old single-instance GTK client and started the freshly built package; the process
  manager reports client/server/PostgreSQL ready. This is launch evidence, not visual/input acceptance.
- No review/save/upload/catalog mutation, schema migration, browser/native UI suite or integration
  suite was run. Desktop appearance/input and transactional write behavior still require Aqua's
  review and the consolidated restored-database/browser/native regression. Static compilation and
  one successful read do not establish full workflow acceptance.

The superseded core HTTP/native contract remains temporarily alongside the new facade; its
minimal UI has been removed. Retire that unused API surface in the next focused cleanup after
this workspace review. Stop at this checkpoint; no commit was requested.
