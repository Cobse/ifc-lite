---
"@ifc-lite/viewer": patch
---

The spatial tree's "Other" bucket (#4764) split direct-container rows on `hasShape` alone, with no physical-object gate — unlike the By Class / By Type tabs, which already go through `AssemblyGeometry.isOther`. A directly contained `IfcAnnotation` (or any other non-physical row) with no representation is schema-legal and ordinary; it was being grayed out and swept into "Other" instead of rendering as a normal selectable row. `emitElementsWithOtherBucket` now buckets a shapeless row under "Other" only when it is also a physical object (`isPhysicalObjectType`), the same predicate the product trees gate on, so the three tree paths agree on what "Other" means.
