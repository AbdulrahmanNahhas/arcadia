---
name: arcadia-cataloging
description: Editorial conventions for adding or revising a work in the Arcadia family media archive — how to score installments across the six criteria, how to set audience and the sexuality/behavioral/theology risk levels, and how to write the Arabic contentWarnings and analysisNotes fields. Use when adding a new title, rescoring, reclassifying, writing content warnings or theological notes, or reviewing whether an existing entry follows house style.
---

# Cataloging a work in Arcadia

This skill is the editorial half. For the mechanics of actually writing to the database, use the
**arcadia-db** skill (`./bin/arcadia work apply`).

Everything reader-facing in this catalog is **Arabic**: `summary`, `contentWarnings`,
`analysisNotes`, and installment titles. English is used only for `canonicalTitle` and slugs.

## Shape of a work

A **title** is the umbrella record (a franchise or a standalone). Beneath it are
**installments** — seasons, films, and specials — and beneath a season, **episodes**.

Classification and the two prose judgement fields live on the **title**. Scores live on the
**installment**: each season is scored separately, because quality moves between seasons.
Installments may override any classification field when one entry is markedly different from
the rest.

## Classification

Five fields on the title:

| Field            | Values                                       |
| ---------------- | -------------------------------------------- |
| `audience`       | `general` · `teen` · `young-adult` · `adult` |
| `age`            | `all` · `7+` · `10+` · `13+` · `16+` · `18+` |
| `sexualityRisk`  | `none` · `low` · `medium` · `high`           |
| `behavioralRisk` | `none` · `low` · `medium` · `high`           |
| `theologyRisk`   | `none` · `low` · `medium` · `high`           |

**In practice `age` is `all` for all 172 titles** — `audience` plus the three risk
dimensions carry the gating signal, and per-account content policies filter on those. Do not
start setting `age` unless the user asks for it.

`audience` is the overall maturity of the work. `general` is the default and the largest group;
`adult` is rare and reserved for works like Arcane.

**`sexualityRisk`** — romance, intimacy, fanservice, nudity, explicit relationships.
**`behavioralRisk`** — violence, gore, cruelty, crime, drugs, suicide, bullying, foul language;
anything a child might imitate or be disturbed by. This is the busiest dimension: only one title
in the catalog is `none`.
**`theologyRisk`** — see below. This is the dimension that most distinguishes this archive.

Verify against neighbours before committing to a level:

```bash
./bin/arcadia stats classification
./bin/arcadia title list --where "behavioral_risk=high" --columns canonical_title,audience --limit 15
```

## Theology risk — the creedal (عقدي) judgement

The question is **not** "does magic appear?" It is: _does the work advance a metaphysical claim
that collides with Islamic ʿaqīdah, and how central is it?_

**Magic on its own is never the problem.** Spells, superpowers, and invented fantasy systems are
storytelling devices; the catalog rates plenty of them `none`. What raises the level is a claim
about the unseen (الغيب) — souls and the afterlife, spirits, fate and qadar, reincarnation,
divination, worship — especially when it mirrors a belief system people actually hold. Arcane's
Hextech and One-Punch Man's superpowers are `none`; Weathering with You's Shinto weather-spirits
are `high`. Judge the metaphysics, not the vocabulary.

**`none`** — no creedal problem. Powers are framed as fantasy or technology with no metaphysical
system behind them.

> Ratatouille: `لا توجد مشكلة عقدية.`
> One-Punch Man: `لا توجد مشكلة عقدية؛ القوى الخارقة فانتازيا كوميدية ساخرة دون عبادات.`
> Arcane: `لا توجد مشكلة عقدية جوهرية؛ السحر والتقنية (Hextech) فانتازيا صناعية دون منظومة عقدية.`

**`low`** — a real religion appears as cultural background, or a speculative premise (time
travel) carries no metaphysical claim. Present but peripheral, or non-doctrinal.

> Anne Shirley: `خلفية مسيحية ثقافية (كنيسة وصلاة) دون طرح لاهوتي مركزي.`
> Trapp Family Story: `القصة مرتبطة مباشرة بالكاثوليكية؛ ماريا راهبة متدربة، وتظهر الأديرة والصلوات والمعتقدات المسيحية بصورة إيجابية ومحورية في الأحداث.`
> Remake Our Life!: `السفر الزمني فرضية خيالية بلا طرح غيبي؛ لا إشكال عقدي.`

**`medium`** — fantasy metaphysics (souls, demons, spirits, an afterlife) used as story
machinery. Central enough to warrant caution, but not a call to a real belief.

> Frieren: `يتضمن السحر والشياطين وتصورات فانتازية عن الجنة والروح كأدوات قصصية دون دعوة لعقيدة واقعية؛ إشكال عقدي بحاجة حذر.`
> Attack on Titan: `توجد طائفة دينية ('عبدة الأسوار') وأسطورة تأسيسية للعمالقة (يمير)، وهي عناصر دينية خيالية داخل العالم دون دعوة صريحة لعقيدة حقيقية؛ إشكال عقدي متوسط رغم حضورها.`
> The Imaginary: `يفترض أن الكائنات المتخيلة تكتسب وجوداً مستقلاً بعد نسيان أصحابها، وهو تصور ميتافيزيقي عن مصير 'الأرواح' مخالف للتصور الإسلامي، محوري في الفرضية.`

**`high`** — a real-world or systematic unseen (غيب) framework sits at the centre of the work and
directly contradicts Islamic creed: Shinto/animist spirit systems, reincarnation, control over
fate/qadar, witch cults.

> Weathering with You: `يقوم على فكرة 'فتاة الطقس' والصلة بأرواح السماء وفق المعتقدات الشنتوية اليابانية حول التحكم بالطقس؛ تصور غيبي محوري.`
> Re:Zero: `يقوم على قدرة 'الرجوع بالموت' للتحكم بالقدر وطائفة عبادة الساحرة، وهو تصادم مع الإيمان بالقدر والغيب في العقيدة الإسلامية.`
> Toilet-bound Hanako-kun: `يقوم بالكامل على خرافات المدارس السبع والأرواح والأشباح والحدود بين عالم الأحياء والأموات في الفولكلور الشنتوي الياباني، وهو طرح غيبي محوري مخالف للعقيدة الإسلامية.`

The deciding axes are **centrality** (background detail vs. the premise) and **reality**
(invented in-world mythology vs. a belief system people actually hold).

## analysisNotes — always written

**Every title in the catalog has `analysisNotes`, including all 79 with `theologyRisk: none`.**
Never leave it empty. It is the justification for the theology level — so it must name the
creedal element specifically, not gesture at "fantasy content". Remember that magic by itself
is not that element.

One or two Arabic sentences. Name the specific element, then give the verdict. When there is no
issue, say so plainly — `لا توجد مشكلة عقدية.` — optionally with a clause explaining why the
apparent problem is not one.

For an unreleased work, mark the judgement provisional:
`تقييم مبدئي حتى العرض الكامل.` / `تقييم مبدئي حتى صدور العمل.`

## contentWarnings — always written

**Every title has `contentWarnings` too.** One Arabic sentence: comma-separated noun phrases,
most severe first, ending in a full stop. Concrete, not euphemistic. Cover violence and gore,
death and grief, romance and intimacy, drugs, foul language, LGBT content, horror, and
psychological distress.

> Arcane: `عنف دموي شديد، قتل واغتيالات، تعاطي وتجارة مخدرات (شيمر)، علاقة شاذة صريحة بين شخصيتين رئيسيتين، رومانسية ولقطات حميمية ضمنية، ألفاظ نابية.`
> 86 EIGHTY-SIX: `عنف حربي دموي شديد، موت متكرر وتشويه أشلاء، إبادة واضطهاد عنصري، انتحار، صدمات نفسية حادة، إجبار قاصرين على القتال.`
> Spider-Verse: `عنف أبطال خارقين ومطاردات وخطر أكشن متصاعد عبر الأجزاء، وفاة أقارب وشخصيات رئيسية وحزن عائلي، نوبة قلق/هلع مصوَّرة بواقعية، توتر أسري بين الآباء والأبناء، ورومانسية مراهقين خفيفة بين الجزأين الثاني والثالث.`

Note the register: it names exactly what happens ("نوبة قلق/هلع مصوَّرة بواقعية") rather than a
generic label. Where a warning applies to only part of a franchise, say which part. For
unreleased works append `التفاصيل النهائية غير مؤكدة قبل العرض.`

The warnings must be consistent with the risk levels — an explicit sexual relationship in the
warnings and `sexualityRisk: none` is a contradiction.

## Scoring

Six criteria, **0–10, half-point steps**, on each installment:

| Criterion       | Weight | Catalog average |
| --------------- | ------ | --------------- |
| `story`         | 0.25   | 7.5             |
| `characters`    | 0.20   | 7.9             |
| `craft`         | 0.20   | 8.5             |
| `depth`         | 0.15   | 7.2             |
| `worldBuilding` | 0.10   | 7.8             |
| `originality`   | 0.10   | 7.4             |

Rating = the weighted sum. A title's rating is the **mean of its fully-scored installments**.

**Score all six or none.** An installment with any criterion left null is excluded from its
title's rating entirely — a partial score is worse than no score.

### What the numbers mean

Across the 245 fully-scored installments the observed range is 3.0–10 (only `depth` reaches
as low as 3.0; every other criterion bottoms out at 4.5). The median installment sits near 8,
so the scale actually in use is roughly 4.5–10, not 0–10.

| Band    | Meaning                                       | Reference                                           |
| ------- | --------------------------------------------- | --------------------------------------------------- |
| 4.5–5.5 | Weak. Thin plotting, filler, flat characters. | Cookin' Idol 4.45 · Don Chuck 4.83 · Cocotama 4.85  |
| 6.0–6.5 | Below average. Watchable, unremarkable.       | The Promised Neverland S2 5.13 (a collapse from S1) |
| 7.0–7.5 | Solid and competent.                          | —                                                   |
| 8.0–8.5 | Strong. The healthy middle of this catalog.   | —                                                   |
| 9.0–9.5 | Excellent.                                    | Monster 9.50 · FMAB 9.55 · Spider-Verse ATSV 9.58   |
| 9.5+    | The very top; used sparingly.                 | Attack on Titan final 9.90 · Avatar Book 3 9.83     |

A 10 on a single criterion is rare — 6 of the 245 scored installments have `story: 10`. Reserve it.

### Reading each criterion

- **story** — plot construction, pacing, payoff. The heaviest weight; be deliberate.
- **characters** — depth, arcs, relationships. Runs slightly high; this catalog favours
  character-driven work.
- **craft** — animation, direction, music, sound. **Systematically the highest** (8.5 average).
  A modern well-funded production rarely drops below 7 here even when the writing is poor, so
  craft alone does not rescue a score.
- **depth** — themes, moral and philosophical substance. **The lowest average and the real
  discriminator.** Most children's shows sit at 3.5–5 here regardless of how polished they are.
  This is where a work earns or loses its place near the top.
- **worldBuilding** — coherence and texture of the setting. For a work with little world to
  build, score the coherence of what exists rather than punishing its scale.
- **originality** — freshness against its genre. Competent genre execution is a 7, not a 5.

Calibrate against neighbours before writing:

```bash
./bin/arcadia stats top
./bin/arcadia stats scores
./bin/arcadia sql "select t.canonical_title, i.title, s.* from installment_scores s
  join installments i on i.id=s.installment_id join titles t on t.id=i.title_id
  where t.canonical_title ilike '%<similar work>%'"
```

## The rest of the record

- **`summary`** — Arabic, three to five sentences: premise and central conflict, no spoilers for
  late developments.
- **`planets`** — the browse universes (`adventure-fantasy`, `emerald`, `bonbon`, `action`,
  `future-technology`, `comedy-fun`, `darkness-mystery`, `history-knowledge`,
  `sports-challenge`). Most titles get exactly one. `./bin/arcadia planet list`.
- **`genres` / `tones` / `tags`** — reuse existing vocabulary. Run `./bin/arcadia genre list`
  first; only pass `--create-missing` when you have confirmed nothing suitable exists, or you
  will fragment the taxonomy.
- **`credits`** — roles come from a fixed list enforced by a database constraint
  (`./bin/arcadia role list`). Person roles and organization roles are distinct; an animation
  studio must be an organization.
- **`workflowStatus`** — new titles start `draft`. Promote to `published` once summary,
  classification, both prose fields, and at least one scored installment are in place.
- **`isPrivate`** — hides a title from the family-facing catalog.
- **`releaseYear`** — on the title; individual `releaseDate`s go on installments.
- **External ids (`tmdbId`, `imdbId`, `tvdbId`, `anilistId`, `malId`)** — both the title and each
  installment carry all five columns, but which level to fill in depends on `kind`:
  - **Anime/TV titles (`kind: "anime"`)** — set them **on the title**. The title is the one TMDB/
    AniList/MAL/TVDB entry; season installments never carry their own ids by design (a season has
    no separate entry on those sites — only the show does).
  - **Movie-kind titles (`kind: "movie"`)** — set them **on the installment only**, never the
    title, even when the title has just one film. A title can hold several films (a franchise
    like Toy Story), each with its own distinct TMDB/IMDb id, so there is no single id that
    correctly represents "the title" — the admin editor's artwork search for a movie-kind title's
    own poster/banner/logo uses its *first* film's id for exactly this reason. Leave
    `title.tmdbId`/`title.imdbId` null for every movie-kind title; a value there for one is a bug,
    not extra coverage — the CLI does not stop you from setting it, so this is on you to avoid.
  - `tvdbId`, `anilistId`, `malId` are used sparingly and only where they add real value — leave
    them null rather than guessing.
  - Verify what you set actually landed: `./bin/arcadia sql "select canonical_title, tmdb_id,
    imdb_id from titles where canonical_title='<name>'"` for the title, or join `installments` for
    a movie's own id. A stale admin-editor tab can still show old values after a write — reload
    it rather than assuming the write failed.

## Adding a new work, end to end

1. **Check it is not already there** — including under another name:
   `./bin/arcadia title list --search "<name>"`
2. **Research** the work: premise, seasons/films, studio, staff, year, and specifically the
   content and creedal issues you will need to describe.
3. **Start from the template**: `./bin/arcadia work template --json > new.json`
4. **Fill it in**: Arabic `summary`, `contentWarnings`, `analysisNotes`; the classification; one
   installment per season/film with its own six scores and episode list.
5. **Check vocabulary and credits resolve** — `genre list`, `role list`, `studio list` — so you
   do not need `--create-missing`.
6. **Rehearse**: `./bin/arcadia work apply new.json --dry-run`
7. **Commit**: `./bin/arcadia work apply new.json`
8. **Add images**: `./bin/arcadia media ingest <file|url> --role poster --title "<name>"`
9. **Verify**: `./bin/arcadia work export "<name>" --json`, then `./bin/arcadia stats coverage`
   to confirm you have not left a gap.
10. **Publish** when complete: `--set workflow_status=published`.

## Self-check before publishing

- `contentWarnings` and `analysisNotes` are both present, in Arabic, and specific.
- The theology level matches what `analysisNotes` actually argues.
- The risk levels do not contradict `contentWarnings`.
- Every installment has all six scores, or none.
- Scores sit sensibly against comparable works — check `stats top` if anything is above 9.
- Genres, tones, and credits reuse existing terms.
- The title has a planet, a release year, and a poster.
- External ids are on the right level: title-level for `kind: "anime"`, installment-level only
  for `kind: "movie"` (`title.tmdbId`/`title.imdbId` must be null there, even for a single film).
