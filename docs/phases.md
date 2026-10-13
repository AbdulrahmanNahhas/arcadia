# Nahhasio delivery sequence

Updated 2026-10-13. Complete the authorized checkpoint, report checks and limitations,
and return for Aqua's review. Historical plans/approvals do not authorize later work.

## Completed: repository cleanup

Aqua authorized all reviewed cleanup, removal of `reference/`, and a cleanup commit.
The concrete result and verification are in [repository-cleanup-2026-10-12.md](repository-cleanup-2026-10-12.md).

Scope: unused source/dependencies, stale configuration/docs, native-player organization,
test command ownership and disposable build output. Preserve client/admin behavior,
database, artwork, backups and unrelated work. No new features.

## Completed: Linux UI foundation

Vite + TanStack Router/Query, Tailwind presentation and the full official Base UI Nova component
set were reviewed and committed as `b60c9ae`. See
[linux-ui-foundation-2026-10-12.md](linux-ui-foundation-2026-10-12.md).

## Current checkpoint: accounts and discovery UI

Aqua authorized database-backed local admin/member accounts, authentication/profile flows,
login/account-menu redesign and the subsequent admin sidebar/layout with empty pages.
See [linux-accounts-checkpoint-2026-10-12.md](linux-accounts-checkpoint-2026-10-12.md).
The website remains the working administration surface while workflows move into the client.
Next complete workflow: works management, with server-enforced permissions and transactions.

Aqua also approved the client discovery designs and requested review/commit of Home,
Search, Browse, Planets, People/Person, Studios/Studio and Episodes. Planet detail uses
the shared works page, and Episodes has simple server-backed filters. See
[linux-discovery-checkpoint-2026-10-13.md](linux-discovery-checkpoint-2026-10-13.md).
Profile, Downloads, Calendar and Watch redesigns remain explicitly deferred.

## After foundation: client administration

1. Inventory working dashboard operations separately from disabled future services.
2. Establish server-enforced admin permission and typed API/native bridge operations.
3. Move complete workflows into the client's own UI in reviewable checkpoints.
4. Preserve transactions, validation, stale-write detection, audit/restore and artwork.
5. Retire `apps/web` and remaining legacy services only after their consumers are replaced.

No admin screen, authorization redesign, catalog migration or new service belongs to cleanup.
Aqua owns client Rust exercises; agents provide interfaces, hints and reviews.

## Existing evidence

- [Local client/API foundation](local-client-foundation-2026-10-08.md).
- [Reviewed Linux work page](linux-work-page-checkpoint-2026-10-10.md).
- [Playback/device-download checkpoints](linux-player-checkpoint.md).
- [UI review queue](linux-ui-review-tasks.md).
- [Native/browser verification](linux-client-testing.md).
- [Historical data/deployment roadmap](archive/nahhasio-roadmap.md).

PostgreSQL remains canonical; `packages/database/drizzle/` is the only migration history.
No startup seeds/imports/migrations. Mutation checks use disposable databases. Live cutovers
require verified independent database/artwork backups and explicit authorization.
