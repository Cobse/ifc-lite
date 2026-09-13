---
"@ifc-lite/wasm": patch
"@ifc-lite/server-bin": patch
---

Coplanar face consolidation after an opening cut no longer fills small real openings on large faces. It used to drop any hole or face region smaller than 1e-4 of its plane's total area, which on a 200 m² slab or wall face removed a 10 x 10 cm penetration. That size test now applies only to rings that are hairline for their own size (a width under 1/8192 of the ring's own size), so a real opening is kept whatever the face size, on the metre path and on the file-unit one alike.
