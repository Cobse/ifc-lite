---
"@ifc-lite/wasm": patch
---

The opening exit-cap's far-field suppression draws the 10 km large-coordinate line where the rest of the engine draws it (`coord_is_large`: strictly greater, any axis, absolute value) instead of comparing `>=` against the constant itself. A host whose farthest vertex sits at exactly 10 000 m is no longer treated as unrepresentable, so its clearance push is decided by the ray probe like any other host's. The watertightness census is byte-identical to `main` over all 112 swept models.
