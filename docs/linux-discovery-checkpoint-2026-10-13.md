# Linux discovery UI checkpoint

Updated 2026-10-13. Aqua approved Home, Search, Browse, Planets, People/Person,
Studios/Studio and Episodes, then requested code review, a dedicated Planet works
page, simple Episode filters and a commit of the reviewed work.

## Reviewed implementation

- Retain Aqua's Maia/Mist/Sky shadcn theme, Arabic fonts, RTL and semantic risk colors.
  Dropdown menus and Select popups use opaque backgrounds for GTK/WebKit.
- Home has the taller banner-only hero, newest works including upcoming installments,
  viewing progress, recent additions before recent episodes, planet discovery,
  favorites, library updates and compact upcoming/family activity sections.
- Planet discovery orders works by their newest released installment. Future
  installments do not affect that order. Catalog state remains server-owned.
- Search and Browse retain URL-owned filters, bounded pagination, account-scoped
  watched state and server-enforced private catalog permissions. Sorting and grouping
  are independent; audience groups order adult, young-adult, teen, general.
- Browse uses a right-side Drawer with tri-state facet buttons and category navigation
  on the left at desktop widths. Smaller screens show the expanded sections.
- Studio, Person and Planet details share one paginated works component with sorting,
  poster/banner/logo views, three card sizes and an admin-only hidden-work switch.
  Planet identity includes its emoji. Studio/person contribution roles remain visible.
- Studio logo backgrounds use corner sampling; transparent artwork receives padding
  after detection. People retain portrait defaults. Directory counts follow visibility.
- Episodes has a compact filter row for watched/unwatched/all, text search and an
  admin-only hidden-work switch. The current feed includes dated released episodes
  and movies, with banner episode cards and portrait movie cards in a responsive
  masonry layout.
  Page rows and totals use identical predicates. Undated/future releases are excluded.
- Shared episode cards support direct playback targets, compact watched state,
  relative dates for the last 30 days and keyboard/touch/hover controls.
- Existing accounts/admin shell, native authorization, avatar assets, fixture updates
  and the opt-in local provisioning utility are included as required foundation.
  Provisioning is never run at startup and was not run during this review.

## Cleanup

Oxc findings were fixed without suppression comments: immutable role sorting,
meaningful card-aspect naming, a typed CSS custom property, an explicit watch target
and a scoped load-more callback. Shared choices accept immutable option lists, and
entity pages use the canonical catalog sort list. First-page metadata access tolerates
an empty page list. The upstream route CLI is loaded through its ESM entry to avoid
its CommonJS circular dependency warning on Node 26; vendored dependencies are unchanged.

The read-only query review also caught and fixed an enum/text comparison in the
movie artwork selection. Registered artwork IDs and existing catalog ownership remain
unchanged. No catalog writes or migrations were performed for this checkpoint.

## Verification and limits

- `devenv shell -- pnpm check`: repository Oxlint, Oxfmt, workspace TypeScript,
  Rust formatting and workspace/all-targets Clippy with warnings rejected.
- `devenv shell -- pnpm build`: TypeScript/UI builds and the Rust workspace build.
- Read-only SQL review: pagination, counts, watched/unwatched, private inclusion,
  search and dated/released predicates against the existing catalog. A synthetic
  account identifier was used; this is SQL validation rather than an authenticated
  GTK journey or proof of permission behavior for every live identity.
- `git diff --check`: reviewed/staged changes.

No tests were authored or executed by this review. Existing and concurrently supplied
fixture changes remain included. No fresh browser/native screenshot or physical
input check was run; Aqua owns the visual review. Historical CSP/hardware-acceleration
limits in the account/native checkpoint are not declared resolved by these builds.
Viewing progress uses recorded state; automatic player position persistence remains
outside this checkpoint. Restart GTK after native command/query changes.

## Deferred UI work

These retain their existing baseline implementation; no new redesign was started:

1. Profile: public profile by default, with own-account editing.
2. Downloads: dedicated page flow and full UX redesign.
3. Calendar: clearer useful release navigation and less crowding.
4. Watch: dedicated UX redesign.

Unrelated pending migration edits and AGENTS.md changes stay outside this commit.
