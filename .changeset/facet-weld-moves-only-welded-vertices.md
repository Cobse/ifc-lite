---
"@ifc-lite/wasm": patch
"@ifc-lite/server-bin": patch
---

The near-coplanar facet weld that runs before an opening cut now writes back only the vertices it welds; every other vertex keeps its input position. It used to rewrite every vertex of the host once anything welded, so two distinct corners within 0.1 mm of each other, on faces it never welded, were merged onto one position.
