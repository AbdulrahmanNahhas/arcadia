# GTK viewing experience: legacy parity pass

Aqua authorized this complete pass on 2026-10-09 while away. The reference is the old app running
at 127.0.0.1:23200 and branch `master`, especially its platform shell, home, catalog filters and
work detail page. Implement the viewing experience independently; do not copy the old monolith.
GTK only. Playback, torrents, Jellyfin and offline video/download expansion remain separate.
No subagents. No commits until Aqua reviews. Preserve the unrelated dashboard chart edit.

## Required outcome

- [ ] Floating horizontal navigation/search, artwork-led home and consistent cards.
- [ ] Hash navigation/back/forward, distinct work, installment, planet, recommendation and browse pages.
- [ ] Bounded server browse, work/installment toggle, sorting, layouts, grouping and card sizing.
- [ ] Full filter sheet: include/exclude facets, privacy, dates, scores/criteria, risks, creators,
      studios, awards, release/structure/video availability and existing watched/progress state.
- [ ] Planet directory/detail pages with icons, artwork, counts and filtered catalog.
- [ ] Recommendations based on real overlap/preferences; no invented personalized success.
- [ ] Full work header and profile, installments/episodes, creators, scores, family and data tabs.
- [ ] Every generated work/installation/episode field has a visible readable destination.
- [ ] Images/metadata/source listings and inherited classification are accessible.
- [ ] Existing account data remains intact; ordinary viewing never edits the catalog.
- [ ] Repo checks/build, behavior/filter/data tests, real GTK rendering and screenshots.

## Reference analysis

The old home combines a large public hero, continue watching, planet gateways, upcoming
installments, family activity, editorial top-rated works and recommendations. The old catalog
allows titles vs seasons/releases, poster/banner/logo/table layouts, grouping, card size and
tri-state taxonomy selection. The work page has a full immersive banner/logo header and profile,
structure, creators, weighted scores, family, and data surfaces. Risks, warnings, analyses,
trivia, related works, aliases, awards, external identities, installment and episode information
must not be reduced to a first-eight preview. Administrative links do not belong in this client.

The new structure groups source by shell/navigation, home, catalog/filtering, discovery and
work/installation pages. Rust owns authenticated queries; the UI uses generated typed responses.
Playback controls remain honest about the separate playback milestone. Offline metadata saving
is not simulated by setting a server flag; it needs a real native pack workflow later.
