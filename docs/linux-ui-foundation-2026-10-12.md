# Linux UI foundation checkpoint — 2026-10-12

Aqua authorized skills revision, Vite + TanStack Router + Query, the full current official
shadcn component set and replacing handwritten component CSS with Tailwind. Administration
migration follows a separate review. Aqua approved this checkpoint and requested its commit.

## Skills revision

Reviewed the repository skills and upstream sources through skills.sh. The CLI refreshed four
project skills: frontend design, Query, Router and Start. Shadcn and the integration source were
already current. Their upstream hashes are recorded in skills-lock.json; project-specific
curation is layered on those sources. Future upstream updates can overwrite that curation:
reapply the desktop boundaries and read the local desktop skill first.

| Skill                                 | Decision                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nahhasio-desktop-ui`                 | Added project guidance for packaged routes, native secrets/CSP, utilities, full registry installation, RTL and verification.                                  |
| `shadcn`                              | Retained current official skill; use the existing Base UI Nova/RTL project context.                                                                           |
| `tanstack-router-best-practices`      | Updated upstream rules and added desktop hash-routing/native context.                                                                                         |
| `tanstack-query-best-practices`       | Updated upstream rules and added existing bounded bridge/cache ownership context.                                                                             |
| `tanstack-integration-best-practices` | Replaced generic entry/context guidance with this project's shared QueryClient, cancellation and cache boundaries. Removed the duplicated SSR hydration rule. |
| `tanstack-start-best-practices`       | Updated upstream guidance and restricted its project scope to apps/web. The desktop uses Vite.                                                                |
| `frontend-design`                     | Updated upstream guidance; restricted aesthetic exploration to approved redesigns, preserving the accepted client design during migrations.                   |
| `arcadia-db`, `arcadia-cataloging`    | Retained database safety and Arabic editorial conventions; no catalog operation in this checkpoint.                                                           |

Removed the stale `install-anti-slop` lock entry and two empty untracked Nahhasio skill directories.
Official TanStack repositories were checked for suitable installable skills; the Router repository's
bundle-optimization skill was outside this task, and Query exposed no replacement skill bundle.
Nine skill frontmatter blocks parsed successfully with YAML. The bundled Python validator could
not run because its PyYAML dependency is absent; the YAML check is reported separately.

Sources: [skills CLI](https://skills.sh/docs/cli),
[Router external data loading](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading),
[Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).

## Desktop implementation

- Vite owns build/dev and automatic route splitting. TanStack owns thirteen page routes plus
  the typed root/context, using hash history. Removed the parallel manual hashchange renderer.
- Router context and QueryClientProvider share one QueryClient. Feature query factories and
  native transport remain their existing owners. Session removal still clears private query data.
- URL parameters remain scalar strings; existing feature validation/parsing is preserved.
- Scroll/focus follow resolved routes, preventing entry into the previous page during lazy loading.
  Ctrl+K waits for search navigation; in-page parameter changes retain scroll.
- Ran official `shadcn add --all --overwrite --yes -c apps/linux/ui`: 61 component files, plus
  the mobile hook, are available. New primitives are imported only by their consumers.
  Generated primitives were not hand-edited. The mobile hook uses useSyncExternalStore to
  satisfy React's effect rule.
- Converted page/player selectors into static responsive/state Tailwind utilities. Removed
  player.css and its import. tailwind.css now contains only imports, fonts and theme tokens.
- Feature inventory: zero raw button/input/select/textarea/label/progress elements; no selector
  stylesheet, CSS module or @apply. Registry primitives retain their own underlying HTML.
- Two runtime style bindings remain: validated catalog planet colors passed through typed CSS
  variables. Static layout/appearance stays in utilities. This is not a claim of zero CSS bytes.
- Login uses Field composition and Alert; ordinary actions use Button, progress uses Progress,
  planet placeholders use Skeleton, counts use Badge. Hero details retain native anchor semantics.
- Player overlays compose official controls while retaining the Base UI footer anchor and custom
  slider draft/cancel behavior. The source drawer stays physically right with RTL content and
  its accepted inset. Episode artwork retains aspect-video geometry.

The client's purple Arabic RTL presentation remains the design authority. No admin route, server
permission change, live catalog mutation or Rust exercise implementation was introduced.

## Verification

Commands run through `devenv shell --`:

| Command                                                          | Result                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                                     | Passed lint, Oxfmt, workspace TypeScript, Cargo formatting and Clippy.                                              |
| `pnpm build`                                                     | Passed workspace/dashboard/native build. Final desktop build also passed separately after layout fixes.             |
| `pnpm --filter @nahhasio/linux-ui test`                          | 26 tests passed.                                                                                                    |
| `pnpm --filter @nahhasio/linux-ui test:e2e`                      | 57 tests passed, production preview.                                                                                |
| `pnpm --filter @nahhasio/linux-ui test:e2e:player`               | 17 tests passed.                                                                                                    |
| `git diff --check`                                               | Passed.                                                                                                             |
| Private native fixture controller, requested 1440 and 520 widths | Both passed 44 scripted checks, synthetic login/home/work/back/logout; zero unexpected routes or catalog mutations. |
| Isolated native player smoke with generated local media          | Failed the existing rendering threshold: two frames in two seconds.                                                 |

Initial checks caught and fixed wide-popup utility conversion, source-drawer direction/inset,
progress assertions after adopting ARIA Progress, search focus and lazy-route card entry. Screenshot
review also caught Button's default height compressing episode thumbnails; corrected layout.

Inspected releases and Watch at 480/1440, desktop people/narrow studios, packaged native
login/home/work, and player episode shelf/source drawer/narrow controls. Fixtures intentionally
include one-pixel artwork and missing images. These are not production artwork assessments.

Private outputs remain ignored under data/previews and apps/linux/ui/test-results. Native artifact
identity is pinned in data/previews/work-review/foundation-manifest.json; the native executable hash
is `12f91d24751938c3ed7accade0b865146a1aec290b1b0f3baeb1f0721a11e8c7`.
The fixture API has no SQL or production forwarding, rejects mutations except synthetic auth,
and removes DATABASE_URL from the child. Production CSP/origin/auth guards were preserved.

## Limits and next review

- Native allocation measured **708×794 CSS pixels at DPR 2** in both requested-width runs.
  These runs certify that measured layout, not exact native 520/1440 widths. Browser journeys
  cover 360–1920 where applicable.
- GTK still reports EGL initialization failure/disabled acceleration, Fontconfig and missing
  GSettings/a11y environment warnings. Two blocked eval CSP events remain per native UI run;
  there were no JavaScript errors/unhandled rejections. CSP was not relaxed.
- Native smoke uses synthetic keys/DOM activation. Physical GTK input, modifiers/new-window
  defaults, GPU smoothness and reliable playback remain unverified.
- Router generation emits an upstream circular-module property warning; generation, build and
  exercised browser/native routes pass. No performance improvement is claimed.
- Installing all registry components does not exercise each unused component under packaged CSP.
  Check a component's native behavior when its first consumer is introduced.

Review the foundation before committing or starting administration. The next administration
checkpoint should inventory working dashboard operations, then establish server-enforced admin
permissions and typed native operations before moving those workflows into the client's UI.
