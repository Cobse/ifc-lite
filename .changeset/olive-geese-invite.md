---
'@ifc-lite/export': patch
---

Follow decomposition in the IFC5 tree filter, so an aggregated element and its geometry survive the default export. `Ifc5Exporter`'s `onlyTreeEntities` (default `true`) kept only what the spatial hierarchy named, so an element attached to its parent by `IfcRelAggregates` / `IfcRelNests` rather than by spatial containment — an `IfcRoof`'s `IfcSlab` parts, an assembly's members — was dropped along with its geometry while the parent stayed as a node with nothing under it. The tree set is now closed over decomposition, and an aggregated child that containment leaves unplaced is listed under the parent that decomposes it instead of being emitted unreachable.
