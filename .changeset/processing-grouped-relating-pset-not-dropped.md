---
"@ifc-lite/wasm": patch
---

Fixed `rust/processing`'s space/zone property resolver silently dropping an `IfcRelDefinesByProperties` relationship whose `RelatingPropertyDefinition` is a grouped `IfcPropertySetDefinitionSet` (schema-legal, written in STEP as `(#20,#22)` rather than a single `#id`). `collect_rel_defines_by_properties_link` now reads that slot with `get_refs`, which accepts both a bare reference and a list, instead of `get_ref`, which only recognises a bare reference. This is the same root cause as issue #4772 / PR #4773 (`apps/server`'s `extract_relationship`) — an independent second site. Currently inert: `MeshData::properties` has no downstream reader (`rust/wasm-bindings/src/zero_copy/mesh.rs` drops it; the viewer reads properties from the TS parser worker), so this is preventive rather than user-facing today.
