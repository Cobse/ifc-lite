---
"@ifc-lite/viewer": patch
---

Raise `PanelWindowHost`'s popped-out window header and footer hints (`text-muted-foreground/70` on a translucent `bg-muted/40`/`bg-muted/30` surface) to plain `text-muted-foreground`, clearing WCAG AA now that the contrast test harness can composite a translucent surface over its backdrop before measuring.
