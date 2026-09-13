---
"@ifc-lite/parser": patch
---

A conversion-based unit whose `ConversionFactor` does not resolve (a dangling or unreadable `UnitComponent`, or a missing or non-positive factor) is no longer read as if the factor were in SI base units. `extractProjectUnits` now uses the known factor for the unit's name, the same table the model length scale reads, so FOOT given as 304.8 of a dangling unit reads as 0.3048 m instead of 304.8 m. A unit whose name has no known factor shows no unit from `unitForMeasure` rather than the SI default, and `resolvedForUnitType` returns `undefined` for it.
