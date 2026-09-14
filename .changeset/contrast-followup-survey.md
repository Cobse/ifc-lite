---
"@ifc-lite/viewer": patch
---

Fix low-contrast secondary text in the eleven files #4792's survey flagged but did not individually verify. Several always-visible text spans — ChunkErrorBoundary's error detail, IDSAuditSummary's path/facet/detail-key labels, EntityContextMenu's duplicate/shortcut hints, RoomPanel's invite hint, CustomizeSidebar's "Hidden" section header, SectionPanel's "or pick an axis" label, the ribbon's group labels, the compare panel's data-count/delta/shape-hash/before-after-arrow text, and LayersPanel's drop-files hint — used `text-muted-foreground` at a `/60`-`/70` opacity tier that measured under WCAG AA's 4.5:1 normal-text minimum in at least one theme. Dropped the opacity suffix to match the codebase's standard muted-on-surface pattern, which clears AA with margin in light, dark and the colorful theme.
