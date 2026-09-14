---
"@ifc-lite/viewer": patch
---

Fix the bSDD panel's property-type tooltip line, which still fell short of WCAG AA (measured 3.29:1 in light mode) after the surrounding tooltip contrast fix. `BsddCard`'s dataType line dropped its `/80` opacity tier to match the sibling description line's plain `text-muted-foreground`, now measuring 4.83:1 (light), 5.42:1 (dark) and 5.76:1 (colorful).
