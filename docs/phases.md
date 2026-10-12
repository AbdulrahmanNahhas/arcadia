# Nahhasio delivery sequence

Updated 2026-10-12. Complete the authorized checkpoint, report checks and limitations,
and return for Aqua's review. Historical plans/approvals do not authorize later work.

## Current authorization: repository cleanup

Aqua authorized all reviewed cleanup, removal of `reference/`, and a cleanup commit.
The concrete result and verification are in [repository-cleanup-2026-10-12.md](repository-cleanup-2026-10-12.md).

Scope: unused source/dependencies, stale configuration/docs, native-player organization,
test command ownership and disposable build output. Preserve client/admin behavior,
database, artwork, backups and unrelated work. No new features.

## Next: Linux UI foundation

Aqua requested Tailwind throughout and modern shadcn controls before administration.
Preserve the client's reviewed visual language, Arabic RTL, keyboard behavior and native bridge.
Component layout/appearance belongs in Tailwind utilities. The shared CSS entry retains imports,
tokens, fonts and global accessibility rules. Remove handwritten page/player selectors as their
consumers are converted; current source still contains selectors that need this separate pass.

Framework choice is under discussion. TanStack Router + Query is recommended for the packaged
client. TanStack Start SPA mode is possible; its server functions still require a server and
cannot replace native Rust transport. Do not change routing during cleanup.
Show the foundation result and browser/native verification before administration.

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
