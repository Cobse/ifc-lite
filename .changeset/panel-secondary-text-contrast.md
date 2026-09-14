---
"@ifc-lite/viewer": patch
---

Fix low-contrast secondary text in the chat, properties, clash, measure and tour panels. Several always-visible text spans — ChatPanel's streaming/usage/keyboard hints, PropertiesPanel's "Size" line, ClashPanel's active detection-mode label, TourStepCard's notices and step counter, HoverTooltip's coordinate readout, and MeasurePanel/MeasureQuantities/MeasurePointReadout's row labels and footnotes — used `text-muted-foreground` at a `/30`-`/80` opacity tier that measured under WCAG AA's 4.5:1 normal-text minimum in at least one theme (some as low as ~1.5:1, near-invisible). Dropped the opacity suffix to match the codebase's standard muted-on-surface pattern, which clears AA with margin in light, dark and the colorful theme.
