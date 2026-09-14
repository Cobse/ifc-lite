---
"@ifc-lite/geometry": patch
"@ifc-lite/viewer": patch
---

`CoordinateHandler` now decides at the exported `NORMAL_COORD_THRESHOLD_M` instead of a private copy of its value, and the federation RTC override (a caller-supplied shared offset wins over the model's own detected offset, and forces the shift) is resolved by one function for all three WASM mesh paths. No behaviour change: every copy held the same rule, which is what made the drift invisible. The viewer's map-absolute detection radius now imports that same constant instead of repeating its value; the radius is unchanged at 10 km.
