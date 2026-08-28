---
name: arcadia-check-baseline-is-red
description: pnpm check already fails on this repo before any new work, so compare against a HEAD baseline instead of expecting green
metadata:
  type: project
---

As of 2026-08-25 on `feat/torrent-player`, `pnpm check` fails on committed code:
**419 `oxlint` errors** (mostly `anti-slop` — `require-safety-comment-for-type-assertion`,
`no-runtime-typeof`, `no-unknown-parameters`; heaviest in `apps/api/src/app.ts`,
`apps/web/src/components/ui/sidebar.tsx`), a handful of Biome findings, and one `tsc` error
(`statistics-page.tsx`: unused `HorizontalRankCard`).

**Why:** "did my change break the build?" cannot be answered by whether `pnpm check` exits 0. It
never does.

**How to apply:** measure a baseline before judging your own work — a detached worktree at HEAD
with the repo's `node_modules` symlinked in, then diff per-file error counts:

```bash
git worktree add --detach /tmp/oxbase HEAD
ln -s "$PWD/node_modules" /tmp/oxbase/node_modules
(cd /tmp/oxbase && node_modules/.bin/oxlint . | grep -cE ": error ")
```

Hold new/edited files to zero *new* errors rather than trying to fix the backlog. Note that
`biome check --write .` reformats ~30 unrelated files — revert those before handoff.
Related: [[api-tests-need-tcp-postgres]].
