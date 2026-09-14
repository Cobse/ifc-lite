---
"@ifc-lite/mcp": minor
---

`query_entities` gains an optional `selector` input, an IfcOpenShell-style selector string (e.g. `"IfcWall, Pset_WallCommon.FireRating=2HR"`). Selector classes union with `type`/`types`; selector property comparisons and `property` narrow the result together. Reuses the SDK's `QueryBuilder.select()` (`@ifc-lite/query`'s shared translator), so it cannot read selector text differently than the CLI's `--select` flag. A selector construct outside the supported lossless subset (see the SDK/query changeset) surfaces as a clean `isError` result naming it, rather than a silently empty or partial result.

Also fixes a pre-existing gap in `descriptor.filters` matching (shared with `property`/`.where()`): a `Qto_` filter previously matched zero entities even when the quantity was present, because the query backend only checked property sets, never quantity sets. It now falls back to quantity sets when no property set matches.
