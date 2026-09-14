---
"@ifc-lite/cli": minor
---

`ifc-lite query --select "<selector text>"`: filter entities with an IfcOpenShell-style selector, e.g. `--select "IfcWall, Pset_WallCommon.FireRating=2HR"`. Selector classes union with `--type`; selector property comparisons and `--where` narrow the result together. Reuses the SDK's `QueryBuilder.select()` (`@ifc-lite/query`'s shared translator), so it cannot read selector text differently than the MCP `query_entities` tool's `selector` param. A selector construct outside the supported lossless subset (see the SDK/query changeset) exits 1 naming it, rather than running an empty or partial query.

Also fixes a pre-existing gap in `bim.query().where(...)`/`descriptor.filters` matching: a `Qto_` filter (e.g. `Qto_WallBaseQuantities.NetVolume>1`) previously matched zero entities even when the quantity was present, because the query backend only checked property sets, never quantity sets. It now falls back to quantity sets when no property set matches, mirroring `--where`'s own existing fallback.
