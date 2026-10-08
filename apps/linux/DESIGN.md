# Linux desktop design checkpoint

Aqua requested a responsive cinematic work page alongside the poster library. The current
implementation uses Compose Desktop with a native desktop window and independent controls.
It remains resizable; it does not use GTK widgets or require a GTK migration to adapt layout.

## Layout and information

- A neutral shell frames the library. Its RTL sidebar appears at widths of at least 1100 dp;
  smaller windows use a compact top bar. Work detail uses an immersive top bar at every width.
- Search, filters and action rows wrap. The library grid adapts its poster width and column
  count, with a more compact header in small windows. Expanded filters have their own bounded
  scrolling area; long work content scrolls naturally. Login can scroll in short windows.
- The work page uses an actual registered panoramic backdrop with a dark gradient, Arabic
  title, original title, year, age, real work rating, counts, genres, summary and actions.
  The local-file player action works; streaming, save and download remain visibly pending.
- Six tabs organize overview; installments/episodes; content risks, analysis and installment
  scores; contributors; metadata/relations; and artwork. Tab focus supports RTL left/right,
  Home and End keys. Episodes expand their real classification and media metadata.
- Taxonomy labels/descriptions, awards, worlds and contributors have human-readable
  presentation. Full generated-contract values, UUIDs, checksums, focal coordinates and
  timestamps remain accessible behind additional/technical-data disclosures.
- Episode stills and contributor portraits appear only when registered artwork exists.
  Missing artwork is not replaced with fabricated images. Episode content classification
  inherits its installment; title warnings/analysis and installment scores are clearly scoped.
- The initial window occupies 88% of available desktop work-area width and 86% of height,
  capped at 1400 × 900 logical units, and is clamped to fit smaller monitors. The user can resize it.

## Theme and source references

Charcoal tokens: canvas #17191C, sidebar #202226, surface #292C31, elevated #34383F,
text #F0F1F3, muted #A2A7B0, borders #3B3F46. Posters/backdrops supply the color; primary
controls use off-white. IBM Plex Sans Arabic is bundled in regular and semibold weights,
with its SIL Open Font License. Compact desktop controls retain visible focus and semantics.

Primary references inspected for independent visual/layout ideas:

- [GNOME Adwaita patterns](https://developer.gnome.org/hig/patterns.html): navigation,
  restrained surfaces and consistent controls.
- [Nuvio Desktop](https://github.com/NuvioMedia/NuvioDesktop), branch Dev,
  `core/ui/ThemeColors.kt` and `features/home/components/HomePosterCard.kt`.
- [Nuvio Mobile](https://github.com/NuvioMedia/NuvioMobile), branch cmp-rewrite,
  `core/ui/AppTheme.kt` and `PosterCardDimensions.kt`.
- [Movy Arcane page](https://movy.sx/tv/94605) and
  [Cinejoy Arcane page](https://cinejoy.pk/series/94605-arcane-2021): parent visually
  inspected panoramic backdrop, title/action hierarchy, episode cards and contributor strips.
  [Spacedom reference](https://spacedom.live/tv/dsHPgXTW) was blocked by verification.

No Nuvio source was copied. Theme, controls, shell, posters, filters, hero, tabs, episodes,
editorial sections, contributors/artwork and metadata have separate implementation files.

## Verification and limits

The supported app-owned `ImageComposeScene` preview reads private login credentials from
stdin, obtains real authorized library/Arcane data and artwork, and logs out afterward.
It renders widths 1440/1024/640/480 at height 600, plus 1440 × 900 hero/episodes/risk previews.
It exercises actual semantic click handlers for every tab and an episode, plus focused
RTL keyboard tab navigation. Arabic-year digit normalization is checked. Screenshot files
are ignored under `data/previews`.

These previews do not capture/control the desktop. Library preview search/filter handlers
are inert for rendering; normal runtime handlers remain real. Work tab/episode handlers are
active and verified through Compose semantics. Offscreen checks do not establish hardware
acceleration, window-manager behavior, full screen-reader QA or real source playback quality.
Fontconfig and GL-fallback warnings remain on this Nix desktop. Torrent streaming, Jellyfin
resolution, downloads, saved packages and viewing-progress sync remain upcoming.
