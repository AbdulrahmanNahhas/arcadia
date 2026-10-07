# Website design rules

The new website is an Arabic-first, RTL family library and control panel. It uses shadcn's
Base UI Nova primitives, TanStack Router/Query, React, and Tailwind 4 in a plain Vite SPA.

## Direction

Use a quiet blue/slate workspace: a narrow right-side navigation rail, a readable page heading,
and a focused content area. The family library remains the subject; avoid implementation
details, marketing copy, decorative charts, large hero posters, animated backdrops, and blur.

The first shell uses these theme values in `apps/web/src/styles.css`:

| Role           | Value     |
| -------------- | --------- |
| Background     | `#f5f7fa` |
| Surface        | `#ffffff` |
| Text           | `#172438` |
| Secondary text | `#5d718a` |
| Borders        | `#e0e7f0` |
| Primary action | `#1b5ad7` |

Use Noto Sans Arabic Variable for Arabic headings/body and Geist Variable for small Latin
utility labels. Font files are self-hosted; only the used language subsets are imported.
The signature is a compact right-hand family navigation rail, not repeated decorative cards.
Dense catalog tables and larger media grids follow this same shell in later phases.

## Enforced rules

All six rules in `oxlint.config.ts` apply to `apps/web/src`:

- `shadcn/no-restyle`: component appearance belongs to variants; callers control layout.
- `shadcn/no-raw-colors`: use semantic tokens, with palette values defined in the CSS theme.
- `shadcn/no-arbitrary-values`: use the spacing/type scale and named theme values.
- `shadcn/no-inline-styles`: use CSS utilities and component APIs.
- `shadcn/no-unknown-classes`: every class must be known to the stylesheet/design system.
- `shadcn/require-static-classes`: use static classes and `cn` for conditional combinations.

Official components live in `src/components/ui` and are installed/updated through the shadcn
CLI. Do not hand-edit them to silence a caller violation. No suppression comments in new UI.
The root anti-slop plugin also applies without the legacy overrides.

## Composition and behavior

- Use variants/sizes, full Card composition, Field/FieldGroup for forms, and Empty/Alert/Badge
  for their respective states. Install only components with a real consumer.
- Use the configured Lucide icons with `data-icon` inside buttons. Let primitives size them.
- Use logical layout utilities, gaps, `size-*`, semantic tokens, and `cn`. No component-specific
  color overrides, overlay stacking hacks, or duplicated spacing systems.
- Keep native link semantics. The current Base UI docs use `buttonVariants` on links rather
  than rendering an anchor through Button, which would give the anchor a button role.
- Every dialog has a title, every field an accessible label, and every icon-only control a name.
- Server failure is a distinct state. Offer a retry, retain keyboard access, and never display
  stale cached health as connected after a failed check.
- Respect reduced motion. Avoid polling unless the feature requires it, and bound its cadence.
- Keep URL state for catalog filters; use Query for server state. Avoid effect-driven copies of
  remote data and persistent state without a documented owner.

Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and browser checks for visible changes.
Review desktop, mobile, keyboard, RTL, loading, empty, and failed-request states.
