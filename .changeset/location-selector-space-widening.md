---
"@ifc-lite/viewer": minor
---

Fixed the viewer's `location="Level 3"` selector filter not matching an element inside an `IfcSpace`/`IfcSpatialZone` on that storey — only elements the storey contained directly (or their aggregated parts) matched, so IfcOpenShell's example `IfcPump, location="Level 3"` (a pump in a room) found nothing. `location=` now reaches one level through a containing space, composing two lookups that already existed (`elementToStorey`, `getContainingSpace`) rather than adding a new rule kind.
