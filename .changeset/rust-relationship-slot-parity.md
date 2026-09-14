---
"@ifc-lite/server-bin": patch
---

The parse server's relationship extraction now covers every schema-derived concrete `IfcRelationship` subtype (54 of 55, `IFCRELASSOCIATES` excluded as a non-instantiable abstract supertype) instead of a hand-written 13-entry list with a `(4,5)` default fallback that silently dropped every other type and mis-read the `IfcRelAssigns` family's attribute order. The attribute positions are generated (`scripts/generate-server-relationship-slots.mjs`) from the same schema-derived source `@ifc-lite/parser`'s in-browser/WASM columnar parser resolves relationship slots against.
