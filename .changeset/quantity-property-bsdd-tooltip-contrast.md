---
"@ifc-lite/viewer": patch
---

Fix tooltip contrast in the Quantities, Properties and bSDD panels. `QuantitySetCard`, `PropertySetCard` and `BsddCard` derive their secondary tooltip lines from `text-muted-foreground` on the shared `bg-popover` / `text-popover-foreground` surface, rather than the hardcoded `text-primary-foreground` opacity tiers they used while the shared tooltip still rendered on the accent-blue primary pair. This repairs a regression from the shared-surface change (the storey object-count breakdown's own tooltip): these three components render inside the same `TooltipContent`, and their secondary text had gone unreadable in light mode, dark mode, and the colorful theme.
