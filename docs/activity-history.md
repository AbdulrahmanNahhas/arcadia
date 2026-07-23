# Activity history

Arcadia stores activity in `history_events`, an immutable append-only ledger.
Current state lives separately in `personal_state` and `work_progress`.

This separation is intentional:

- A corrected current status does not rewrite the past.
- Backdated activity can be inserted without changing today's progress.
- Reimports can be idempotent.
- Feed and yearly statistics use the occurrence time, while audit tools can
  still see when the event was recorded.

## Adding one event

Open **Feed → Add activity → Quick entry**:

1. Choose the work.
2. Choose what happened: progress, status, rating, or a rewatch/reread.
3. Set the original date and only the details relevant to that action.

The episode/chapter selector appears only for progress events. Optional time
spent stays under **More options**. **Update the work's current record** is
enabled by default; disable it when reconstructing old history that should not
alter the current library status, rating, replay count, or progress.

## Importing JSON

Open **Feed → Add activity → JSON import** or use the complete JSON editor in
the admin dashboard.

```json
{
  "applyToCurrentState": false,
  "events": [
    {
      "externalKey": "journal-2024-03-24-frieren-episode-1",
      "workId": "obsidian-animation-tv-frieren-beyond-journeys-end",
      "unitId": "gold-obsidian-animation-tv-frieren-beyond-journeys-end-season-1-episode-1",
      "eventType": "progress_updated",
      "occurredAt": "2024-03-24T20:30:00Z",
      "progressBefore": 0,
      "progressAfter": 1,
      "durationMinutes": 26,
      "notes": "Imported from an older journal."
    }
  ]
}
```

### Required fields

| Field | Meaning |
| --- | --- |
| `workId` | Existing Arcadia work ID. |
| `eventType` | One of the supported event types below. |
| `occurredAt` | ISO-8601 timestamp including `Z` or an explicit offset. |

### Optional fields

| Field | Meaning |
| --- | --- |
| `externalKey` | Stable ID from the source system. Duplicate keys are skipped, making a repeated import safe. |
| `seasonId` / `unitId` | Granular target. Supply at most one. IDs are visible in the admin JSON editor. |
| `statusBefore` / `statusAfter` | Personal status transition. `statusAfter` is required for `status_changed`. |
| `progressBefore` / `progressAfter` | Numeric progress transition. `progressAfter` is required for `progress_updated`. |
| `ratingValue` | Rating from 0–10. Required for `rated`. |
| `durationMinutes` | Time spent during this event. |
| `notes` | Personal context, up to 10,000 characters. |

Supported event types:

- `started`
- `status_changed`
- `progress_updated`
- `season_completed`
- `work_completed`
- `dropped`
- `rewatched`
- `reread`
- `rated`
- `activity_voided` (normally created by **Remove from feed**)

Supported statuses are `planned`, `in-progress`, `completed`, `paused`, and
`dropped`.

Imports are atomic: if any non-duplicate event is invalid, none of the new
events in that request are committed. Existing ledger rows cannot be edited or
deleted.

## Removing a mistaken activity

Use **Remove from feed** on an activity. Arcadia appends an
`activity_voided` correction and hides both the original event and correction
from the normal feed and statistics. This preserves the audit trail without
leaving accidental status toggles in the visible chronology.

Removing an activity does not rewind current status or progress. Adjust the
current state separately if the mistaken event also changed it.

## Structural data rules

`works → work_seasons → work_units` is an ordering and progress structure, not a
second catalog.

- A unit requires only `unitType`, `position`, and its parent work. Use
  `unitNumber` when the displayed number differs from `position + 1`.
- `title`, `runtimeMinutes`, `pageCount`, and `releaseAt` are optional
  enrichment. Do not manufacture values such as “Episode 1” or repeat a
  standard runtime on every row.
- Season titles are required because the season is a named navigation group.
  Season runtime and unit count are optional and should be derived when
  possible.
- Novels and manga use the same minimal rule. Plain numbered chapters do not
  need titles; genuinely named chapters or epilogues may use `title`.

## Complete admin JSON document

The admin JSON editor exports `schemaVersion: 1` documents:

```json
{
  "schemaVersion": 1,
  "records": [
    {
      "work": {},
      "structure": {
        "workId": "…",
        "seasons": [],
        "ungroupedUnits": []
      },
      "history": {
        "existing": [],
        "append": {
          "applyToCurrentState": false,
          "events": []
        }
      }
    }
  ]
}
```

- `work` contains editable catalog and personal-state fields.
- `structure` contains editable seasons and units. Keep IDs that are referenced
  by history; their descriptive fields and ordering may still be changed.
- `history.existing` is a read-only audit snapshot.
- Add new history only through `history.append.events`.
