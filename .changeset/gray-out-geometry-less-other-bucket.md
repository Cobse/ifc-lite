---
"@ifc-lite/viewer": patch
---

An `IfcElement` with no geometry — a placement carrying `Representation = $`, and no `IfcRelAggregates` part with one either — is now grayed out and grouped under a collapsed "Other" node, following the BIMcollab Zoom convention, instead of sitting inline among normal rows (spatial tree) or being silently dropped (By Class, By Type). The headline object count each tree already reports is unchanged — these elements were already excluded from it — this only changes how the row itself is shown.

The distinction is keyed off the same explicit `geometryReady`/`geometryKnown` readiness flag the count already uses, never off `geometricIds.size > 0`: while a model is still streaming, every element renders normally with no "Other" bucket, so there is no flash of every row going gray and back on load. `AssemblyGeometry` (`productTree.ts`) gains an `isOther` predicate alongside its existing `renders`, reusing the same schema test, shape test and aggregation walk rather than adding a second "has geometry" rule; the spatial tree reuses the existing `hasShape`/`makeShapeTest` function it already builds the count from.

`emitElementSubtree` and the new `emitElementsWithOtherBucket` helper (spatial tree) move to `elementSubtree.ts`, and the "Other" bucket's row-building (By Class / By Type) is shared through a new `otherBucket.ts`, so `treeDataBuilder.ts` stays under its module-size budget and the bucket's shape can't drift between the two product trees.
