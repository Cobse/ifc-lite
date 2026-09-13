---
"@ifc-lite/wasm": patch
"@ifc-lite/server-bin": patch
---

Coplanar face consolidation after an opening cut no longer fills small real openings on large faces. It used to drop any hole or face region smaller than 1e-4 of its plane's total area, which on a 200 m² slab or wall face removed a 10 x 10 cm penetration. It now drops only regions narrower than the kernel's snap step.
