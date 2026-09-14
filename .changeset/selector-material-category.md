---
"@ifc-lite/viewer": minor
"@ifc-lite/ids": minor
---

The viewer's selector adapter's `material=` filter term now matches an element's material Category as well as its Name, mirroring IfcOpenShell's grammar: a wall whose `IfcMaterial` is Name "Fired Clay Brick" / Category "Masonry" now matches `material=Masonry`, where before only a Category-blind Name comparison ran and the term silently matched nothing. Category values are collected through `flattenMaterials`, the IDS material facet's own flattener (now exported from `@ifc-lite/ids`), reused rather than re-walked, so the selector's `material=` and the IDS `<material>` facet answer "does this element's material graph carry X" through one traversal instead of two that could drift. Material NAME matching (layer / constituent / profile / list members, `#1462`) is unchanged and still excludes a layer's own label.
