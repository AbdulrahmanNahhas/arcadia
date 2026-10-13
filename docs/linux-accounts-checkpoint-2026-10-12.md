# Linux accounts and administration shell

Updated 2026-10-12. Aqua authorized basic database-backed accounts/authentication, profile and
login/account-menu redesign, then the admin sidebar/layout and empty pages. This checkpoint
prepares the migration; the website remains the working administration surface.

## Implemented

- Existing Better Auth identities, credential hashes and session ownership remain canonical.
  Rust login supports active, unbanned owner/admin/member identities. Admin access requires
  both an administrative identity role and an admin account kind, checked against PostgreSQL.
- The requested local accounts are `admin@nahhasio.local` (owner/admin) and
  `user@nahhasio.local` (member/personal), each with a distinct bundled avatar selected in the
  database. Credentials were provisioned explicitly for local development, never at startup.
- A redesigned Arabic login includes password visibility, Caps Lock feedback and pending/error
  states. The official shadcn account dropdown links to the user's own profile, conditionally
  exposes administration and signs out with identity-scoped Query cache invalidation.
- Profile fields include name, bio and one of two bundled avatars. Updates are transactional,
  reject unknown fields/role changes and detect stale writes using the account timestamp.
  Credential changes verify the current password, preserve Better Auth scrypt/NFKC compatibility,
  and revoke other sessions while retaining the current one.
- The native bridge has fixed, typed profile/password/admin/avatar operations. Bearer tokens
  remain native. Generated contracts retain a single OpenAPI owner; there is no arbitrary URL
  or command bridge and no browser database access.
- Ordinary viewers can browse the public catalog and use their own personal state. Private
  discovery, direct private works and associated artwork are denied server-side. Restricted
  family policies fail closed until policy-aware filtering is implemented. The requested local
  member has an unrestricted public viewing policy; this is not a child-profile rollout.
- `/admin` has a server-checked parent layout and 31 empty section routes matching the existing
  dashboard inventory: content/editorial collections, images/JSON/maintenance/revisions/graph/
  tables, and server/accounts/profiles/policies/devices/jobs/logs/backups/integrations/settings.
  The client retains its purple RTL design, with wide desktop and compact narrow navigation.
  Sections explicitly say they are pending. No fake counts or enabled administrative mutations.

## Data preservation and cleanup

An ignored full PostgreSQL dump was created at
`data/backups/accounts-checkpoint-20261012T163301Z.dump`, its archive inspected, and its complete
restore rehearsed on a disposable database before applying the requested account provisioning.
Before/after full-row fingerprints and counts for 65 protected catalog tables matched exactly;
private records are `data/backups/accounts-protected-{before,after}.json`.

Three obsolete demo identities were suspended and their sessions revoked. Their account IDs,
foreign-key links and histories remain recoverable. No catalog table, migration history, account
history or artwork was dropped. The two requested identities are the active local accounts.
Existing admin identity/profile IDs were preserved. The opt-in development tool is
`packages/database/scripts/provision-local-accounts.ts`; it is not a production setup flow.

Active artwork was restored from the retained recovery copy into ignored `data/media` so
existing database artwork paths resolve. The recovery copy remains intact. No schema migration
was needed. A future destructive cutover still requires independently stored, verified backups
of PostgreSQL and artwork; the local checkpoint dump does not replace that requirement.

## Deployment boundaries

The client communicates through HTTP contracts; GTK is not part of account or server policy.
This leaves other desktop/mobile shells possible later. Fedora/Podman deployment must mount
persistent PostgreSQL/artwork storage and provide authenticated transport. Server downloads,
Jellyfin integration, devices and viewing profiles retain separate ownership from login identities
and this device's downloads. Their prepared admin pages do not implement those services.

## Verification

- `pnpm check`: lint, Oxfmt, workspace TypeScript, Rust formatting and workspace Clippy passed.
- Linux UI production build and Rust server/native builds passed.
- Better Auth compatibility and authentication unit checks: 4 passed.
- Guarded restored-database account smoke: 26 real API checks passed, including stale writes,
  password validation/revocation, rejected role patches, banned accounts and demoted admins.
  No mutation test used the live catalog. The disposable account database was removed afterward.
- Live native bridge: 16 replies verified both requested accounts through login, session, own
  profile, avatar, public Browse, admin permission and logout. Verification sessions were revoked.
- Browser suite: 60/61 passed initially; the remaining account-menu/shortcut journey was
  corrected and passed on the focused rerun, including Escape/focus restoration.
- Packaged GTK fixture: 46/46 checks passed, including account menu, canonical profile and an
  admin empty page, plus existing work-page behavior. Actual viewport 520×974, DPR 2. The private
  driver holds smoke readiness while it checks accounts and captures the profile in `work.png`;
  this is an explicit profile capture, not a work-page screenshot. Zero mutations/unexpected
  routes, two CSP eval blocks, and no runtime JavaScript errors. Frozen artifact hashes and
  captures are under ignored `data/previews/work-review/accounts-episodes-520/`.

Native fixture checks use a frozen bundle/binary, synthetic sessions and loopback mock API,
with no SQL or production forwarding. Browser journeys do not prove native physical input or GPU
behavior. Existing EGL/hardware-acceleration and CSP-eval warnings remain; CSP was not weakened.
The earlier player frame-threshold failure is not resolved by account work.

## Next workflow

Move works management first: server-paginated listing and filters, work editor with real
relationships/artwork, transactional saves, validation and stale-write handling. Replace private
website bridge operations with session-authorized Rust endpoints and typed native calls before
enabling controls. Retire the website only when its complete workflows have replacements.
