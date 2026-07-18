# Extraction schema

Implemented in `netlify/functions/analyze-drawing.mjs` (a normal synchronous function).
The full prompt and the `responseSchema` (Gemini's dialect, uppercase types) live in the
function's source code — this file documents the data shape for anyone consuming the
result on the frontend.

## One file per call, merged client-side

`analyze-drawing.mjs` receives **one file at a time** (`{file, mimeType, name}`). When
the user uploads several sheets together, `js/upload.js` calls the function **once per
file, in sequence**, and merges the `components` from all responses client-side
(`mergeExtractions()`), deduplicating by `tag + component_type` — if the same tag shows
up on two sheets, only one entry remains, preferring the version that already has
`poles` determined over `not_available`.

**Why it's not one call with all files at once:** that was the first approach tried and
it wasn't reliable in this project:
- A single synchronous call with 4 PDFs together exceeds the ~10s execution limit of a
  normal Netlify Function ("Inactivity Timeout" error).
- The obvious alternative — running as a **Background Function** (up to 15 min
  execution) — never actually executed: jobs got stuck at "pending" indefinitely, well
  past the 15-minute window. Most likely Background Functions are a paid-plan feature,
  not available on the free tier used here. Couldn't confirm from logs (no
  dashboard/CLI access in the dev environment), so this is recorded as a hypothesis, not
  a certainty — worth reconsidering if the site moves to a paid plan (would recover
  cross-sheet reasoning within the same AI call, see below).

**Cost of this decision:** each file is analyzed in isolation by the AI — it doesn't see
the other sheets while processing one, so it doesn't cross-reference "relay legend on
sheet X" with "symbol on the single-line diagram on sheet Y" within the same reasoning
pass. That's a real precision loss in some cases, but each sheet still correctly
extracts whatever is determinable on its own (tested against the 4 real drawings from
the R-MSSB7-ESS project).

## Response

```json
{
  "drawing": { "number": "ME332", "title": "SWITCHBOARD LAYOUT", "project": "R-MSSB7-ESS" },
  "components": [
    {
      "tag": "DCR1",
      "description": "DAMPER CONTROL RELAY",
      "component_type": "relay",
      "brand": "WEIDMULLER",
      "manufacturer_reference": "",
      "poles": 0,
      "pole_source": "not_available",
      "evidence": "Relay legend lists 'DCR1 DAMPER CONTROL RELAY, GF-MFD1' — gives tag and function, not model or poles.",
      "confidence": "high",
      "sheet": "ME333",
      "notes": ""
    }
  ],
  "general_notes": ""
}
```

## The 3 values of `pole_source`

| Value | Meaning | Expected frequency |
|---|---|---|
| `legend` | The drawing's legend/BOM table states the pole count in text | Rare |
| `symbol` | Pole count determined by counting phase busbars (N/A/B/C) the symbol touches on the single-line diagram | Common for breakers/switches |
| `not_available` | The drawing only gives brand/tag/function, no determinable pole count | **Most cases**, mainly relays and contactors |

When `pole_source` is `not_available`, `poles` comes back `0` (sentinel) and resolution
happens on the review screen via catalog cross-reference (see `catalog-schema.md`) or
manual entry.

## The `evidence` field

Required, free text, no length limit. Needs to be specific enough for a person to
double-check against the original drawing without reopening everything from scratch —
it quotes the exact legend text, or concretely describes which busbars/phases the
symbol touches. "3 poles" alone isn't acceptable evidence; the prompt instructs the
model to never return that without describing what it actually saw.

## The `resolved_via` field (review screen only, not part of extraction)

Added client-side when saving the reviewed list: `"extraction"` (value came straight
from the AI, no intervention), `"catalog"` (user accepted a catalog suggestion),
`"manual"` (user typed/edited the value). Tracks the real origin of the data that feeds
the purchase decision, separate from what the AI read on the drawing.
