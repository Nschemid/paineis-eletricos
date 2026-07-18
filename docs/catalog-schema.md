# Catalog — data shape and matching algorithm

Netlify Blobs store `catalog` (via `netlify/functions/data.mjs?store=catalog`), a single
blob holding the whole array as JSON. Starts empty — never seed it with fake data.

## Item shape

```json
{
  "id": "uuid-v4",
  "component_type": "relay",
  "brand": "WEIDMULLER",
  "reference": "",
  "tag_pattern": "DCR",
  "application": "damper control interposing relay / fan start-stop",
  "poles": 1,
  "notes": "company-standard relay for fan start/stop signaling",
  "created_at": "2026-07-18T12:00:00.000Z",
  "updated_at": "2026-07-18T12:00:00.000Z"
}
```

`reference` and `tag_pattern` are optional on purpose: since most real drawings don't
carry the manufacturer's full part number (see `extraction-schema.md`), the catalog
also needs to match by type + tag pattern + application, not just exact reference.

## Matching algorithm (`js/match.js`, runs client-side, no backend logic)

Three tiers, first hit wins:

1. **Exact/prefix reference** — normalize (`toUpperCase`, strip spaces/hyphens) and
   compare the extracted item's `manufacturer_reference` against the catalog's
   `reference` via equality or `startsWith` in either direction (covers a drawing's
   truncated "SIEMENS 3RT20..." matching a full catalog "3RT2016-1BB41"), only when
   `brand` also matches (when present on both sides).
2. **Tag pattern** — strip trailing digits from `tag` (`DCR1` → `DCR`) and compare
   against the catalog's `tag_pattern`, combined with equal `component_type`.
3. **Type + application (simple fuzzy match)** — `component_type` + `brand` (if
   present) + word overlap between the item's `description`/`evidence` and the
   catalog's `application` (lowercase, split on whitespace, count shared words above a
   small threshold). No external library, no embeddings.

## Resulting status per row

- `confirmed` — tier 1 or 2, single candidate
- `suggested` — tier 3, or multiple candidates at any tier (shown as a clickable chip,
  never auto-applied)
- `no_match` — no candidate

In every case, `poles` stays editable on the review table — the catalog only
pre-fills it, the user decides.
