---
"@ifc-lite/viewer": patch
---

Imported DXF reference underlays now survive a page reload. The 2D drawing markup persistence added for issue #4153 (measurements, areas, text and cloud annotations, display options) deliberately excluded `dxfUnderlays` — a DXF import can embed arbitrary point counts, plausibly over `localStorage`'s ~5MB synchronous budget — leaving it as the one piece of that issue still unresolved. It is now persisted to IndexedDB instead, keyed by the same full-content hash the other markup fields use, with the same per-entry validation, quota/unavailable-storage degrade, and 20-entry eviction cap. Restoring it is additive rather than a replace: `dxfUnderlays` is a workspace-scoped field that already survives an ordinary model switch within a session, so restoring a previously-saved underlay for a newly active model's hash only adds it back alongside whatever is already loaded, never clearing or replacing the live set.
