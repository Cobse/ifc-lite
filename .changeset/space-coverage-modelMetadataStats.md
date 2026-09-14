---
"@ifc-lite/viewer": patch
---

Added the missing `modelMetadataStats.test.tsx` coverage a merged PR's mutation table had described but never committed: a meshed `IFCSPACE` fixture entity, asserting it stays excluded from "Elements with Geometry" even though it passes the shape test — guarding `computeModelStats`'s schema filter (`collectPhysicalEntityIds`) independently of the shape filter. No production code changed.
