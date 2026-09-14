---
"@ifc-lite/viewer": patch
---

The material filter's value dropdown now suggests a value even when it exists only on a non-primary material association (an element carrying more than one `IfcRelAssociatesMaterial`, e.g. a layer set plus a plain fallback material) — previously the dropdown only sampled the primary association, so such a value matched via `material=` but was never offered as a suggestion.
