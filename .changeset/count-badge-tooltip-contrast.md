---
"@ifc-lite/viewer": patch
---

Fix tooltip contrast across the viewer, including the storey object-count breakdown. The shared tooltip now uses the neutral `bg-popover` / `text-popover-foreground` surface (measured at 19.9:1 in light mode and 8.52:1 in dark mode) instead of the accent-blue primary pair that could reach only 2.52:1 in light mode. Count-badge secondary lines now use `text-muted-foreground` rather than hardcoded zinc shades.
