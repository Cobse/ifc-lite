---
"@ifc-lite/server-bin": patch
---

Fixed the parse server silently dropping an `IfcRelDefinesByProperties` relationship whose `RelatingPropertyDefinition` is a grouped `IfcPropertySetDefinitionSet` (schema-legal, written in STEP as `(#20,#21)` rather than a single `#id`) — every related object lost every property/quantity set in that group. The generated relationship-slot table (`scripts/generate-server-relationship-slots.mjs`) now also derives a `relating_is_list` flag from the same schema source the in-browser/WASM columnar parser resolves against, so the extractor reads the grouped form instead of unconditionally treating "relating" as a single reference.
