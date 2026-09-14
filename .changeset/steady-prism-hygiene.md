---
"@ifc-lite/geometry": patch
---

Clean analytic prism cuts before their final ulp weld so removable slivers cannot choose a surviving seam coordinate, while preserving the audited pre-clean result when hygiene would open the surface.
