---
"@ifc-lite/viewer": minor
---

The viewer's selector adapter reads `GlobalId=` and `GlobalId!=` as a comparison now, not only the bare `325Q7Fhnf67OZC$$r43uzK` term: both reuse the same `globalId` filter rule (exact-identity, case-sensitive set membership) the bare term already builds, so `IfcWall, GlobalId=325Q7Fhnf67OZC$$r43uzK` no longer silently matches nothing. `*=`, `>`, `>=`, `<`, `<=`, a `/regex/` value, and `NULL` are still reported by name rather than approximated, since a GlobalId is a fixed 22-character identity, not text to search within or order.
